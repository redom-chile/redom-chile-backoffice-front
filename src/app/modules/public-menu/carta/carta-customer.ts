import { HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, Subject, Subscription, switchMap, take, tap, throwError } from 'rxjs';
import type { LegalMeDto, PendingDocumentDto } from 'src/app/core/services/legal/dtos';
import { readApiError } from 'src/app/core/utils/api-error';
import {
  CustomerLoyaltyDto,
  CustomerPreferencesDto,
  CustomerProfilesSetting,
  CustomerUsualDto,
  PublicCustomerDto,
  PublicCustomerMeDto,
  PublicCustomerProfilesDto,
} from '../data-access/dtos/customer-profiles.dto';
import { PublicLocationMenuDto, PublicProductDto, PublicTagDto } from '../data-access/dtos/public-menu.dto';
import { customerHeaders, PublicCustomerApiService } from '../data-access/public-customer-api.service';
import { isCartaLang } from './carta-i18n';
import { pendingDocumentsOf, sanitizePending } from './carta-legal';
import { readSavedCustomer, saveCustomer } from './carta-online';

/** Respaldo de customerProfiles.redomPrivacyUrl (política de privacidad de Redom para clientes). */
export const REDOM_PRIVACY_URL = 'https://redom.cl/privacidad';

const TOKEN_KEY = 'redom-customer-token';
const PREFS_KEY = 'redom-customer-prefs';
/** Datos del pago (carta-online). */
const SAVED_CUSTOMER_KEY = 'redom-customer';
const MAX_TAGS = 40;
const PATCH_DELAY = 600;

const EMPTY_PREFS: CustomerPreferencesDto = { dietTags: [], allergenTags: [], language: null };

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Modo privado o almacenamiento lleno: queda en memoria
  }
}

const codes = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((c): c is string => typeof c === 'string' && c.length <= 60))].slice(0, MAX_TAGS) : [];

/** Solo la forma esperada (el almacenamiento o la respuesta pueden venir incompletos). */
export function sanitizePreferences(raw: unknown): CustomerPreferencesDto {
  if (!raw || typeof raw !== 'object') return EMPTY_PREFS;
  const p = raw as Record<string, unknown>;
  return { dietTags: codes(p['dietTags']), allergenTags: codes(p['allergenTags']), language: isCartaLang(p['language']) ? p['language'] : null };
}

function readPrefs(): CustomerPreferencesDto {
  try {
    return sanitizePreferences(JSON.parse(readStorage(PREFS_KEY) ?? 'null'));
  } catch {
    return EMPTY_PREFS;
  }
}

/** "Contiene maní" → "maní" (las etiquetas llegan traducidas). */
const CONTAINS = /^(contiene|contains|cont[eé]m|enth[aä]lt)\s+/i;
export const allergenShortName = (tag: PublicTagDto): string => (CONTAINS.test(tag.name) ? tag.name.replace(CONTAINS, '') : tag.name.toLowerCase());

export type ProductConflicts = Readonly<{ allergens: readonly PublicTagDto[]; diets: readonly PublicTagDto[] }>;

/** Alérgenos que el cliente evita y que el producto tiene; dietas suyas que el producto no tiene (solo una pista). */
export function productConflicts(product: PublicProductDto, prefs: CustomerPreferencesDto, tags: ReadonlyMap<string, PublicTagDto>): ProductConflicts | null {
  const allergens = prefs.allergenTags.filter((c) => product.tags.includes(c)).map((c) => tags.get(c)).filter((t): t is PublicTagDto => t?.kind === 'allergen');
  const diets = prefs.dietTags.filter((c) => !product.tags.includes(c)).map((c) => tags.get(c)).filter((t): t is PublicTagDto => t?.kind === 'diet');
  return allergens.length || diets.length ? { allergens, diets } : null;
}

type Place = Readonly<{ businessSlug: string; locationSlug: string }>;
type TagKinds = ReadonlyMap<string, string>;

const PROFILE_SETTINGS: readonly string[] = ['enabled', 'showUsual', 'showLoyalty'] satisfies CustomerProfilesSetting[];

/**
 * El backend solo acepta códigos de etiquetas de dieta y de alérgenos (otro código: 400). Quedan los de la carta del
 * tipo correcto y los que el perfil ya tenía (vienen de otros locales y el servidor ya los validó).
 */
function knownCodes(list: readonly string[], kind: 'diet' | 'allergen', tags: TagKinds, saved: readonly string[]): string[] {
  return list.filter((code) => tags.get(code) === kind || (!tags.has(code) && saved.includes(code)));
}

/**
 * Etapa 10: cliente de la carta, identificado por correo. Token (localStorage redom-customer-token) y perfil cuando el local usa el modo
 * verified; preferencias del perfil o, sin él, del navegador (redom-customer-prefs, en todos los planes); mantiene
 * redom-customer (datos del pago) al día. Sin customerProfiles (o en la vista previa) no llama al backend.
 */
@Injectable({ providedIn: 'root' })
export class CartaCustomer {
  readonly #api = inject(PublicCustomerApiService);

  readonly #token = signal<string | null>(readStorage(TOKEN_KEY));
  readonly profile = signal<PublicCustomerDto | null>(null);
  readonly usual = signal<CustomerUsualDto | null>(null);
  readonly loyalty = signal<CustomerLoyaltyDto | null>(null);
  readonly settings = signal<PublicCustomerProfilesDto | null>(null);
  /** OTP_QUOTA_EXCEEDED: el local pasa a modo navegador durante la visita. */
  readonly quotaExceeded = signal(false);
  /** 409 CUSTOMER_PROFILES_DISABLED (details.setting): se oculta lo que el local apagó, durante la visita. */
  readonly #disabled = signal<ReadonlySet<string>>(new Set());
  /** Documentos legales del cliente (GET /customers/me): pendientes e historial. null: sin cargar. */
  readonly legal = signal<LegalMeDto | null>(null);
  /** Pendientes que bloquearon un pedido (428): la vista de la carta muestra el aviso y, al aceptar, se reintenta. */
  readonly legalPrompt = signal<readonly PendingDocumentDto[] | null>(null);
  readonly #legalAnswer = new Subject<boolean>();
  /** El perfil se cargó por primera vez en esta visita (para aplicar su idioma). */
  readonly loadedAt = signal(0);

  readonly #localPrefs = signal<CustomerPreferencesDto>(readPrefs());
  #place: Place | null = null;
  #loads: Subscription | null = null;
  #patch: ReturnType<typeof setTimeout> | null = null;
  #pending: Partial<CustomerPreferencesDto> = {};
  /** Tipo de cada etiqueta de la carta (código → diet / allergen / badge). */
  #tagKinds: TagKinds = new Map();
  /** Preferencias tal como las devolvió el servidor. */
  #serverPrefs: CustomerPreferencesDto = EMPTY_PREFS;

  /** El local ofrece identificarse con código (modo verified, con plan y sin cuota agotada). */
  readonly verifiedMode = computed(() => {
    const s = this.settings();
    return !!s?.enabled && s.mode === 'verified' && !this.quotaExceeded() && !this.#disabled().has('enabled');
  });
  readonly verified = computed(() => this.verifiedMode() && !!this.#token() && !!this.profile());
  readonly preferences = computed(() => (this.verified() ? this.profile()!.preferences : this.#localPrefs()));
  readonly showUsual = computed(() => this.verified() && !!this.settings()?.showUsual && !this.#disabled().has('showUsual'));
  readonly showLoyalty = computed(() => this.verified() && !!this.settings()?.showLoyalty && !this.#disabled().has('showLoyalty'));
  /** Con pendientes: usual, loyalty y los pedidos identificados responden 428; la carta sigue funcionando. */
  readonly legalPending = computed(() => (this.verified() ? (this.legal()?.pending ?? []) : []));
  readonly redomPrivacyUrl = computed(() => this.settings()?.redomPrivacyUrl || REDOM_PRIVACY_URL);

  /** La vista de la carta lo llama con la carta (null en la vista previa). */
  configure(menu: PublicLocationMenuDto | null): void {
    const settings = menu?.customerProfiles ?? null;
    const place = menu ? { businessSlug: menu.business.slug, locationSlug: menu.location.slug } : null;
    const samePlace = place?.businessSlug === this.#place?.businessSlug && place?.locationSlug === this.#place?.locationSlug;
    this.settings.set(settings);
    this.#tagKinds = new Map((menu?.tags ?? []).map((tag) => [tag.code, tag.kind]));
    if (samePlace && this.profile()) return;
    this.#place = place;
    if (!samePlace) {
      this.quotaExceeded.set(false);
      this.#disabled.set(new Set());
      this.usual.set(null);
      this.loyalty.set(null);
    }
    this.#refresh();
  }

  /** Correo del perfil identificado: el pedido debe usarlo (si no, CUSTOMER_EMAIL_MISMATCH). */
  readonly profileEmail = computed(() => (this.verified() ? (this.profile()?.email ?? null) : null));

  /** Datos del pago: perfil (si está identificado) y lo recordado en redom-customer. */
  checkoutDefaults(): Readonly<{ name: string; phone: string; email: string }> {
    const saved = readSavedCustomer();
    const p = this.verified() ? this.profile() : null;
    return p ? { name: p.name || saved.name, phone: p.phone || saved.phone, email: p.email } : saved;
  }

  /** Header X-Redom-Customer para POST /orders (solo identificado en un local con el modo verified). */
  headers(): HttpHeaders | undefined {
    return this.verified() ? customerHeaders(this.#token()) : undefined;
  }

  /**
   * Envía con el header y, si el token venció (401 CUSTOMER_TOKEN_INVALID), cierra la sesión y reintenta sin él. Con
   * documentos pendientes (428 LEGAL_ACCEPTANCE_REQUIRED) pide aceptarlos y reintenta; si el cliente no acepta, falla.
   */
  withCustomer<T>(request: (headers?: HttpHeaders) => Observable<T>): Observable<T> {
    const headers = this.headers();
    if (!headers) return request();
    return request(headers).pipe(
      catchError((e) => {
        if (this.#isTokenError(e)) {
          this.#clearSession();
          return request();
        }
        const pending = readApiError(e).status === 428 ? pendingDocumentsOf(e) : null;
        if (!pending) return throwError(() => e);
        return this.#askLegal(pending).pipe(
          switchMap((accepted) => {
            const retry = this.headers();
            return accepted && retry ? request(retry) : throwError(() => e);
          }),
        );
      }),
    );
  }

  /** Cierra el aviso de pendientes (true: los aceptó). */
  answerLegalPrompt(accepted: boolean): void {
    if (!this.legalPrompt()) return;
    this.legalPrompt.set(null);
    this.#legalAnswer.next(accepted);
  }

  /** Acepta versiones vigentes (pendientes o marketingConsent del negocio); con todo al día recarga lo que falló. */
  acceptLegal(versionIds: readonly number[], businessSlug?: string): Observable<LegalMeDto> {
    const token = this.#token();
    if (!token) return throwError(() => new Error('CUSTOMER_TOKEN_INVALID'));
    return this.#api.acceptLegal(token, { versionIds: [...versionIds], ...(businessSlug ? { businessSlug } : {}) }).pipe(
      tap((legal) => this.#applyLegal(legal)),
      catchError((e) => this.#legalError(e)),
    );
  }

  /** Retira un consentimiento opcional (marketingConsent del negocio). */
  withdrawLegal(documentCode: string, businessSlug?: string): Observable<LegalMeDto> {
    const token = this.#token();
    if (!token) return throwError(() => new Error('CUSTOMER_TOKEN_INVALID'));
    return this.#api.withdrawLegal(token, { documentCode, ...(businessSlug ? { businessSlug } : {}) }).pipe(
      tap((legal) => this.#applyLegal(legal)),
      catchError((e) => this.#legalError(e)),
    );
  }

  /** Vuelve a leer los documentos del cliente (p. ej. una versión dejó de estar vigente). */
  reloadLegal(): void {
    const token = this.#token();
    if (!token || !this.verified()) return;
    this.#api.me(token).subscribe({
      next: (customer) => this.#applyLegal(customer.legal),
      error: (e) => {
        if (this.#isTokenError(e)) this.#clearSession();
      },
    });
  }

  #askLegal(pending: readonly PendingDocumentDto[]): Observable<boolean> {
    if (pending.length) this.legal.update((legal) => ({ accepted: legal?.accepted ?? [], pending: [...pending] }));
    this.legalPrompt.set(pending.length ? pending : (this.legal()?.pending ?? []));
    return this.#legalAnswer.pipe(take(1));
  }

  #applyLegal(raw: LegalMeDto | null | undefined): void {
    if (!raw || typeof raw !== 'object') return;
    const before = this.legal()?.pending.length ?? 0;
    const legal: LegalMeDto = { pending: sanitizePending(raw.pending), accepted: Array.isArray(raw.accepted) ? raw.accepted : [] };
    this.legal.set(legal);
    // Al quedar al día se vuelven a pedir lo de siempre y el saldo (respondían 428)
    if (before && !legal.pending.length) this.#loadExtras();
  }

  #legalError(error: unknown): Observable<never> {
    if (this.#isTokenError(error)) this.#clearSession();
    else if (readApiError(error).code === 'LEGAL_VERSION_NOT_PUBLISHED') this.reloadLegal();
    return throwError(() => error);
  }

  /** 409 CUSTOMER_PROFILES_DISABLED: oculta lo que el local apagó (true si era ese error). */
  handleDisabled(error: unknown): boolean {
    const api = readApiError(error);
    if (api.code !== 'CUSTOMER_PROFILES_DISABLED') return false;
    const setting = api.details['setting'];
    const key = typeof setting === 'string' && PROFILE_SETTINGS.includes(setting) ? setting : 'enabled';
    this.#disabled.update((set) => new Set([...set, key]));
    if (key === 'showUsual') this.usual.set(null);
    if (key === 'showLoyalty') this.loyalty.set(null);
    return true;
  }

  /** Tras verificar el código (aceptó los documentos vigentes; el historial llega con /customers/me). */
  signedIn(token: string, customer: PublicCustomerDto): void {
    this.#token.set(token);
    writeStorage(TOKEN_KEY, token);
    this.legal.set({ pending: [], accepted: [] });
    this.#setProfile(customer, true);
    this.#loadExtras();
    this.reloadLegal();
  }

  /** Dieta, alérgenos o idioma: en el navegador siempre; en el perfil (PATCH con pausa) si está identificado. */
  setPreferences(change: Partial<CustomerPreferencesDto>): void {
    const next = sanitizePreferences({ ...this.preferences(), ...change });
    this.#saveLocal(next);
    const profile = this.profile();
    if (!this.verified() || !profile) return;
    this.profile.set({ ...profile, preferences: next });
    this.#pending = { ...this.#pending, ...change };
    if (this.#patch) clearTimeout(this.#patch);
    this.#patch = setTimeout(() => this.#flushPreferences(), PATCH_DELAY);
  }

  updateProfile(change: Readonly<{ name?: string | null; phone?: string | null }>): Observable<PublicCustomerDto | null> {
    const token = this.#token();
    if (!token) return of(null);
    return this.#api.updateMe(token, change).pipe(
      catchError((e) => {
        if (this.#isTokenError(e)) this.#clearSession();
        else this.handleDisabled(e);
        return throwError(() => e);
      }),
    );
  }

  applyProfile(customer: PublicCustomerDto): void {
    this.#setProfile(customer, false);
  }

  /** Invalida los tokens en el servidor; aunque falle, se cierra aquí. */
  logout(): void {
    const token = this.#token();
    this.#clearSession();
    if (token) this.#api.logout(token).subscribe({ error: () => undefined });
  }

  deleteMe(): Observable<void> {
    const token = this.#token();
    if (!token) return of(undefined);
    const done = (sub: { next: () => void; complete: () => void }) => {
      this.#clearSession();
      this.#forgetDevice();
      sub.next();
      sub.complete();
    };
    return new Observable<void>((sub) => {
      const request = this.#api.deleteMe(token).subscribe({
        next: () => done(sub),
        // Token vencido: el perfil ya no se puede usar desde aquí; se borra lo del dispositivo igual
        error: (e) => (this.#isTokenError(e) ? done(sub) : sub.error(e)),
      });
      return () => request.unsubscribe();
    });
  }

  /** Preferencias y datos del pago guardados en este navegador. */
  #forgetDevice(): void {
    this.#saveLocal(EMPTY_PREFS);
    writeStorage(PREFS_KEY, null);
    writeStorage(SAVED_CUSTOMER_KEY, null);
  }

  /** Recarga "Lo de siempre" (p. ej. después de pedir). */
  reloadUsual(): void {
    if (this.verified()) this.#loadExtras();
  }

  #refresh(): void {
    this.#loads?.unsubscribe();
    this.#loads = null;
    const token = this.#token();
    if (!this.verifiedMode() || !token || typeof window === 'undefined') {
      if (!token) this.profile.set(null);
      return;
    }
    this.#loads = this.#api.me(token).subscribe({
      next: (customer: PublicCustomerMeDto) => {
        this.legal.set(null);
        this.#applyLegal(customer.legal ?? { pending: [], accepted: [] });
        this.#setProfile(customer, true);
        this.#loadExtras();
      },
      error: (e) => {
        if (this.#isTokenError(e)) this.#clearSession();
        else this.handleDisabled(e);
      },
    });
  }

  #loadExtras(): void {
    const token = this.#token();
    const place = this.#place;
    // Con documentos pendientes responden 428: se piden al aceptarlos
    if (!token || !place || this.legal()?.pending.length) return;
    if (this.showUsual()) {
      this.#api.usual(token, place).subscribe({
        next: (usual) => this.usual.set(usual),
        error: (e) => this.#extraError(e, () => this.usual.set(null)),
      });
    }
    if (this.showLoyalty()) {
      this.#api.loyalty(token, place).subscribe({
        next: (loyalty) => this.loyalty.set(loyalty),
        error: (e) => this.#extraError(e, () => this.loyalty.set(null)),
      });
    }
  }

  #extraError(error: unknown, clear: () => void): void {
    if (this.#isTokenError(error)) this.#clearSession();
    else if (!this.handleDisabled(error)) {
      clear();
      const pending = pendingDocumentsOf(error);
      if (pending?.length) this.legal.update((legal) => ({ accepted: legal?.accepted ?? [], pending }));
    }
  }

  #setProfile(customer: PublicCustomerDto, fresh: boolean): void {
    const preferences = sanitizePreferences(customer.preferences);
    this.#serverPrefs = preferences;
    this.profile.set({ ...customer, preferences });
    this.#saveLocal(preferences);
    const saved = readSavedCustomer();
    saveCustomer({ name: customer.name || saved.name, phone: customer.phone || saved.phone, email: customer.email || saved.email });
    if (fresh) this.loadedAt.set(Date.now());
  }

  #flushPreferences(): void {
    this.#patch = null;
    const token = this.#token();
    const pending = this.#pending;
    const saved = this.#serverPrefs;
    this.#pending = {};
    const change: Partial<CustomerPreferencesDto> = {
      ...pending,
      ...(pending.dietTags ? { dietTags: knownCodes(pending.dietTags, 'diet', this.#tagKinds, saved.dietTags) } : {}),
      ...(pending.allergenTags ? { allergenTags: knownCodes(pending.allergenTags, 'allergen', this.#tagKinds, saved.allergenTags) } : {}),
    };
    if (!token || !Object.keys(change).length) return;
    this.#api.updateMe(token, { preferences: change }).subscribe({
      next: (customer) => (this.#serverPrefs = sanitizePreferences(customer.preferences)),
      error: (e) => {
        if (this.#isTokenError(e)) this.#clearSession();
        else this.handleDisabled(e);
      },
    });
  }

  #saveLocal(prefs: CustomerPreferencesDto): void {
    this.#localPrefs.set(prefs);
    writeStorage(PREFS_KEY, JSON.stringify(prefs));
  }

  #clearSession(): void {
    if (this.#patch) clearTimeout(this.#patch);
    this.#patch = null;
    this.#pending = {};
    this.#loads?.unsubscribe();
    this.#token.set(null);
    writeStorage(TOKEN_KEY, null);
    this.profile.set(null);
    this.usual.set(null);
    this.loyalty.set(null);
    this.legal.set(null);
    this.answerLegalPrompt(false);
  }

  #isTokenError(error: unknown): boolean {
    const api = readApiError(error);
    return api.status === 401 || api.code === 'CUSTOMER_TOKEN_INVALID';
  }
}
