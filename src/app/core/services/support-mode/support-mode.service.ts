import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, EMPTY, filter, interval } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ToastService } from 'src/ui';
import { EntitlementsDto } from '../entitlements/dtos';
import { SUPPORT_HOME } from './support-urls';

/** Acceso de soporte con el que el SUPERADMIN entró al negocio. */
export type SupportSession = Readonly<{ grantId: number; businessId: number; businessName: string; expiresAt: string }>;

const STORAGE_KEY = 'redom.support-session';

function readStorage(): SupportSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as SupportSession;
    return value && typeof value.businessId === 'number' && new Date(value.expiresAt).getTime() > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function writeStorage(value: SupportSession | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin sessionStorage el modo dura hasta recargar.
  }
}

/**
 * Modo soporte (#50): el SUPERADMIN gestiona la carta de un negocio que lo autorizó.
 * Mientras está activo, supportAccessInterceptor agrega X-Support-Business-Id a las llamadas a restaurant,
 * el menú y los guards se limitan a la carta y los candados usan el plan del negocio.
 * Se guarda en sessionStorage (sobrevive a recargar la pestaña, no a cerrarla).
 */
@Injectable({ providedIn: 'root' })
export class SupportModeService {
  readonly #http = inject(HttpClient);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);

  readonly #session = signal<SupportSession | null>(readStorage());
  readonly #entitlements = signal<EntitlementsDto | null>(null);

  readonly $session = this.#session.asReadonly();
  readonly $active = computed(() => this.#session() !== null);
  readonly $businessId = computed(() => this.#session()?.businessId ?? null);
  /** Plan del negocio del acceso (para los candados), de GET /platform/businesses/:id. */
  readonly $entitlements = this.#entitlements.asReadonly();

  constructor() {
    // Diferido: este servicio puede crearse dentro de una petición (interceptor) y pedir otra ahí formaría un ciclo.
    if (this.#session()) queueMicrotask(() => this.#loadEntitlements());
    // Al vencer el acceso se sale solo (el backend también lo corta).
    interval(60_000)
      .pipe(
        filter(() => {
          const session = this.#session();
          return !!session && new Date(session.expiresAt).getTime() <= Date.now();
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.exit('El acceso de soporte terminó'));
  }

  /** Entra en modo soporte y abre la carta del negocio. */
  enter(session: SupportSession) {
    this.#session.set(session);
    this.#entitlements.set(null);
    writeStorage(session);
    this.#loadEntitlements();
    this.#router.navigateByUrl(SUPPORT_HOME);
  }

  /** Sale del modo soporte y vuelve a Plataforma (con un aviso si el acceso terminó). */
  exit(message?: string) {
    if (!this.#session()) return;
    this.#session.set(null);
    this.#entitlements.set(null);
    writeStorage(null);
    if (message) this.#toast.show(message, 'warning');
    this.#router.navigateByUrl('/platform/businesses');
  }

  #loadEntitlements() {
    const businessId = this.#session()?.businessId;
    if (!businessId) return;
    this.#http
      .get<{ entitlements: EntitlementsDto }>(`${ApiPathEnum.BILLING}/platform/businesses/${businessId}`)
      .pipe(catchError(() => EMPTY))
      .subscribe((detail) => {
        if (this.#session()?.businessId === businessId) this.#entitlements.set(detail.entitlements ?? null);
      });
  }
}
