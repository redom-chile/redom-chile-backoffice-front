import { computed, inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { EntitlementsService } from '../services/entitlements/entitlements.service';
import { WhoamiService } from '../services/whoami/whoami.service';
import type { PermissionCode } from './index';

/**
 * Qué puede hacer el usuario conectado: permisos de todos sus roles juntos (whoami.permissions).
 * SUPERADMIN puede todo. Con `environment.enforcePermissions` apagado, todo está permitido en el front.
 * El plan es un filtro aparte (EntitlementsService): una pantalla se usa si el plan la incluye y el rol tiene el permiso.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  readonly #whoami = inject(WhoamiService);
  readonly #entitlements = inject(EntitlementsService);

  readonly $isSuperAdmin = this.#entitlements.$isSuperAdmin;
  readonly $isOwner = this.#entitlements.$isOwner;
  readonly $permissions = computed(() => new Set(this.#whoami.$whoami()?.permissions ?? []));
  /** Sin filtro de permisos: apagado por ambiente o superadmin. */
  readonly $unrestricted = computed(() => !environment.enforcePermissions || this.$isSuperAdmin());
  /** Módulos de Roles y permisos (`moduleCode`, ej. `INVENTORY`) que el plan no incluye. */
  readonly $lockedModules = computed(() => new Set(this.#entitlements.$entitlements()?.lockedModules ?? []));

  /** Tiene el permiso (con una lista: alguno; con `all`: todos). */
  can(permission: PermissionCode | readonly PermissionCode[], mode: 'any' | 'all' = 'any'): boolean {
    if (this.$unrestricted()) return true;
    const own = this.$permissions();
    const list: readonly PermissionCode[] = typeof permission === 'string' ? [permission] : permission;
    if (!list.length) return true;
    return mode === 'all' ? list.every((code) => own.has(code)) : list.some((code) => own.has(code));
  }

  /** Tiene el permiso tal cual, sin el atajo de ambiente: para no ofrecer en Roles y permisos lo que el backend rechaza. */
  owns(permission: string): boolean {
    return this.$isSuperAdmin() || this.$permissions().has(permission);
  }

  moduleInPlan(moduleCode: string): boolean {
    return this.$isSuperAdmin() || !this.$lockedModules().has(moduleCode);
  }
}
