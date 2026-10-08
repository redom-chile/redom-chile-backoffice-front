import { computed, inject } from '@angular/core';
import { EntitlementsService, PlanLimitCode, PlanUpsellService } from 'src/app/core/services/entitlements';

export const PLAN_LIMIT_REACHED_TOOLTIP = 'Llegaste al límite de tu plan';

/**
 * Para los botones de crear: si el límite del plan está lleno, el botón se ve deshabilitado y al
 * hacer clic abre el modal para mejorar el plan. Llamar en un contexto de inyección.
 */
export function planLimitGate(code: PlanLimitCode) {
  const entitlements = inject(EntitlementsService);
  const upsell = inject(PlanUpsellService);
  return {
    $canAdd: computed(() => entitlements.canAdd(code)),
    /** true si se puede crear; si no, abre el modal y devuelve false. */
    allow(): boolean {
      if (entitlements.canAdd(code)) return true;
      upsell.open({ limit: code, max: entitlements.limitOf(code) ?? undefined, used: entitlements.usageOf(code) });
      return false;
    },
  };
}
