import { computed, inject, Signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, PlanUpsellService } from 'src/app/core/services/entitlements';
import { AiQuotaDto, disabledSettingOf, getMenuAiErrorMessage, isRouteMissing } from 'src/app/modules/products/pages/menu-ai/data-access';

export const MENU_AI_FEATURE = 'menuAiContent' as const;
export const MENU_AI_NOT_DEPLOYED_MESSAGE = 'Este servidor no tiene la IA para la carta.';
// Carta → Mejorar con IA → Configuración (setting: ajuste a enfocar).
export const MENU_AI_SETTINGS_ROUTE = '/products/improve';
export const MENU_AI_SETTINGS_QUERY = { tab: 'settings', setting: 'isEnabled' } as const;

export type MenuAiAccess = Readonly<{
  /** El usuario puede editar productos (sin permiso no se muestran los botones). */
  canUse: boolean;
  /** El plan incluye menuAiContent. */
  $enabled: Signal<boolean>;
  /** Uso del plan este mes según entitlements (no considera el tope propio del negocio). */
  $planQuota: Signal<AiQuotaDto>;
  openUpsell: () => void;
}>;

/** Llamar en contexto de inyección. */
export function injectMenuAiAccess(): MenuAiAccess {
  const entitlements = inject(EntitlementsService);
  const upsell = inject(PlanUpsellService);
  return {
    canUse: inject(AccessService).can(PERMISSIONS.PRODUCTS.UPDATE_PRODUCT),
    $enabled: computed(() => entitlements.hasFeature(MENU_AI_FEATURE)),
    $planQuota: computed(() => ({ used: entitlements.usageOf('aiMenuContentMonth'), limit: entitlements.limitOf('aiMenuContentMonth') })),
    openUpsell: () => upsell.open({ features: [MENU_AI_FEATURE] }),
  };
}

export type MenuAiFailure =
  | Readonly<{ kind: 'disabled' }>
  // message null: error de plan, lo muestra el modal global.
  | Readonly<{ kind: 'toast'; message: string | null }>;

export function toMenuAiFailure(error: unknown, fallback: string): MenuAiFailure {
  if (isRouteMissing(error)) return { kind: 'toast', message: MENU_AI_NOT_DEPLOYED_MESSAGE };
  if (disabledSettingOf(error) === 'isEnabled') return { kind: 'disabled' };
  return { kind: 'toast', message: getMenuAiErrorMessage(error, fallback) };
}

/** "Te quedan 12 de 100 este mes" o "Sin límite este mes". */
export function quotaHint(quota: AiQuotaDto): string {
  if (quota.limit === null) return `Llevas ${quota.used} este mes · Sin límite`;
  return `Te quedan ${Math.max(0, quota.limit - quota.used)} de ${quota.limit} este mes`;
}
