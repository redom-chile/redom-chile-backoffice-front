import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, filter, fromEvent } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { WhoamiService } from '../whoami/whoami.service';
import { EntitlementsDto, LockableResource, PlanFeatureCode, PlanLimitCode } from './dtos';

const REFRESH_AFTER_MS = 5 * 60 * 1000;

/**
 * Lo que puede usar el negocio según su plan. Se siembra con whoami (user.entitlements) y se refresca con
 * GET {BILLING}/entitlements al volver a la pestaña (5 min o más), tras cambiar locales, cajas o usuarios
 * y ante un error PLAN_*. El acceso de cada usuario es plan ∩ permisos de su rol; SUPERADMIN no tiene límites.
 * Sin datos (backend sin billing o error) no se bloquea nada: el backend valida igual.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  readonly #http = inject(HttpClient);
  readonly #whoami = inject(WhoamiService);

  readonly #value = signal<EntitlementsDto | null>(null);
  #loadedAt = 0;

  readonly $entitlements = this.#value.asReadonly();
  readonly $isSuperAdmin = computed(() => !!this.#whoami.$whoami()?.roles.some((role) => role.code === 'SUPERADMIN'));
  readonly $isOwner = computed(() => !!this.#whoami.$whoami()?.roles.some((role) => role.code === 'OWNER'));
  /** Sin restricciones: superadmin, o todavía no se sabe el plan. */
  readonly $unrestricted = computed(() => this.$isSuperAdmin() || !this.#value());
  readonly $features = computed(() => new Set<PlanFeatureCode>(this.#value()?.features ?? []));
  /** El usuario actual está sobre el límite de usuarios del plan: solo lectura. */
  readonly $currentUserLocked = computed(() => {
    const code = this.#whoami.$whoami()?.user.code;
    return !this.$isSuperAdmin() && !!code && !!this.#value()?.lockedResources.users.includes(code);
  });

  constructor() {
    // whoami trae los entitlements (y se refresca solo cada minuto con la pestaña activa).
    effect(() => {
      const whoami = this.#whoami.$whoami();
      if (whoami === undefined) {
        this.#value.set(null);
        return;
      }
      const fromWhoami = whoami.user.entitlements;
      if (fromWhoami !== undefined) this.#set(fromWhoami);
    });

    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => document.visibilityState === 'visible' && Date.now() - this.#loadedAt >= REFRESH_AFTER_MS),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.refresh());
  }

  refresh() {
    if (!this.#whoami.$whoami()?.user.restaurantId) return;
    this.#http
      .get<EntitlementsDto>(`${ApiPathEnum.BILLING}/entitlements`)
      .pipe(catchError(() => EMPTY))
      .subscribe((entitlements) => this.#set(entitlements));
  }

  hasFeature(code: PlanFeatureCode): boolean {
    return this.$unrestricted() || this.$features().has(code);
  }

  hasFeatures(codes: readonly PlanFeatureCode[]): boolean {
    return codes.every((code) => this.hasFeature(code));
  }

  /** null = ilimitado (o plan desconocido). */
  limitOf(code: PlanLimitCode): number | null {
    return this.$isSuperAdmin() ? null : (this.#value()?.limits[code] ?? null);
  }

  usageOf(code: PlanLimitCode): number {
    return this.#value()?.usage[code] ?? 0;
  }

  canAdd(code: PlanLimitCode): boolean {
    const limit = this.limitOf(code);
    return limit === null || this.usageOf(code) < limit;
  }

  isLocked(resource: LockableResource, id: number | string | null | undefined): boolean {
    if (id === null || id === undefined || this.$isSuperAdmin()) return false;
    return (this.#value()?.lockedResources[resource] as ReadonlyArray<number | string> | undefined)?.includes(id) ?? false;
  }

  #set(value: EntitlementsDto | null) {
    this.#value.set(value);
    this.#loadedAt = Date.now();
  }
}
