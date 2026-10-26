import { inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import type { LegalVersionDto, PendingDocumentDto } from 'src/app/core/services/legal/dtos';
import { readApiError } from 'src/app/core/utils/api-error';
import { DINER_REQUIRED_DOCUMENTS, MARKETING_CONSENT_CODE, PrivacyAcknowledgementDto } from '../data-access/dtos/customer-profiles.dto';
import { PublicMenuApiService } from '../data-access/public-menu-api.service';
import { cartaLanguage } from './carta-i18n';

/** Documentos que el cliente acepta antes de pedir el código (los sin versión publicada no se muestran). */
export type DinerDocuments = Readonly<{ required: readonly LegalVersionDto[]; marketing: LegalVersionDto | null }>;

const isBrowser = () => typeof window !== 'undefined';

/** Pendientes de details.documents (428/400 LEGAL_ACCEPTANCE_REQUIRED), solo con la forma esperada. */
export function pendingDocumentsOf(error: unknown): PendingDocumentDto[] | null {
  const api = readApiError(error);
  if (api.code !== 'LEGAL_ACCEPTANCE_REQUIRED') return null;
  const raw = api.details['documents'];
  return sanitizePending(raw);
}

export function sanitizePending(raw: unknown): PendingDocumentDto[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is PendingDocumentDto =>
      !!d && typeof d === 'object' && Number.isInteger((d as PendingDocumentDto).versionId) && typeof (d as PendingDocumentDto).title === 'string',
  );
}

/**
 * Lecturas públicas del módulo legal para la carta (sin sesión): versión vigente de un documento en el idioma de la carta
 * (404: sin versión publicada → null) y versiones exactas. Guarda en memoria durante la visita. También la versión de
 * privacyPolicy que se muestra en pedidos sin perfil y reservas (privacyVersionId).
 */
@Injectable({ providedIn: 'root' })
export class CartaLegal {
  readonly #api = inject(PublicMenuApiService);
  readonly #documents = new Map<string, Observable<LegalVersionDto | null>>();
  readonly #versions = new Map<number, Observable<LegalVersionDto>>();

  /** privacyPolicy vigente en el idioma de la carta (null: sin cargar o sin versión publicada). */
  readonly privacy = signal<LegalVersionDto | null>(null);
  #privacyLang: string | null = null;

  /** Vigente en el idioma de la carta; null si no hay versión publicada (404). Otros errores se propagan. */
  document(code: string, businessSlug?: string | null): Observable<LegalVersionDto | null> {
    const lang = cartaLanguage();
    const key = `${code}|${lang}|${businessSlug ?? ''}`;
    let cached = this.#documents.get(key);
    if (!cached) {
      cached = this.#api.getLegalDocument(code, lang, businessSlug).pipe(
        tap((doc) => this.#versions.set(doc.versionId, of(doc))),
        catchError((e) => {
          if (readApiError(e).status === 404) return of(null);
          this.#documents.delete(key);
          return throwError(() => e);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.#documents.set(key, cached);
    }
    return cached;
  }

  version(id: number): Observable<LegalVersionDto> {
    let cached = this.#versions.get(id);
    if (!cached) {
      cached = this.#api.getLegalVersion(id).pipe(
        catchError((e) => {
          this.#versions.delete(id);
          return throwError(() => e);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.#versions.set(id, cached);
    }
    return cached;
  }

  /** Descarta las vigentes guardadas (cambiaron: LEGAL_ACCEPTANCE_REQUIRED o LEGAL_VERSION_NOT_PUBLISHED). */
  forget(code?: string): void {
    for (const key of [...this.#documents.keys()]) if (!code || key.startsWith(`${code}|`)) this.#documents.delete(key);
  }

  /** dinerTerms, privacyPolicy y dinerDataConsent (de la plataforma) y marketingConsent del negocio. */
  dinerDocuments(businessSlug: string): Observable<DinerDocuments> {
    return forkJoin([
      forkJoin(DINER_REQUIRED_DOCUMENTS.map((code) => this.document(code))),
      this.document(MARKETING_CONSENT_CODE, businessSlug).pipe(catchError(() => of(null))),
    ]).pipe(map(([required, marketing]) => ({ required: required.filter((d): d is LegalVersionDto => !!d), marketing })));
  }

  /** Carga (o recarga si cambió el idioma) la privacyPolicy que se muestra sin perfil. */
  loadPrivacy(): void {
    if (!isBrowser() || this.#privacyLang === cartaLanguage()) return;
    this.#fetchPrivacy().subscribe();
  }

  /**
   * Envía con privacyVersionId (la versión mostrada). Si dejó de estar publicada (400 LEGAL_VERSION_NOT_PUBLISHED) recarga la
   * vigente y reintenta una vez con ella.
   */
  withPrivacy<T>(send: (dto: PrivacyAcknowledgementDto) => Observable<T>): Observable<T> {
    const ack = (doc: LegalVersionDto | null): PrivacyAcknowledgementDto => (doc ? { privacyVersionId: doc.versionId } : {});
    return send(ack(this.privacy())).pipe(
      catchError((e) => {
        if (readApiError(e).code !== 'LEGAL_VERSION_NOT_PUBLISHED') return throwError(() => e);
        this.forget('privacyPolicy');
        return this.#fetchPrivacy().pipe(switchMap((doc) => send(ack(doc))));
      }),
    );
  }

  #fetchPrivacy(): Observable<LegalVersionDto | null> {
    const lang = cartaLanguage();
    this.#privacyLang = lang;
    return this.document('privacyPolicy').pipe(
      catchError(() => {
        // Sin conexión o error: se reintenta la próxima vez; el backend registra la vigente sin privacyVersionId
        this.#privacyLang = null;
        return of(null);
      }),
      tap((doc) => this.privacy.set(doc)),
    );
  }
}
