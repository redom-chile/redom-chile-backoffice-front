import { PlanInterval, PlatformPlanDto } from '../../data-access';

export type PlanFlag = 'isPublic' | 'isFree' | 'isHighlighted' | 'isActive';

/** Switches del formulario del plan (crear y editar). */
export const PLAN_FLAG_FIELDS: ReadonlyArray<Readonly<{ key: PlanFlag; label: string; hint: string }>> = [
  { key: 'isActive', label: 'Activo', hint: 'Inactivo: ya no se ofrece. Solo se puede si no tiene suscripciones vigentes.' },
  { key: 'isPublic', label: 'Público', hint: 'Apagado: plan a medida, solo lo asigna el equipo de Redom.' },
  { key: 'isHighlighted', label: 'Destacado', hint: 'El plan recomendado en la comparación de la landing.' },
  { key: 'isFree', label: 'Free', hint: 'Plan gratis, sin precios.' },
];

export const PLAN_CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const PLAN_INTERVAL_SUFFIX: Record<PlanInterval, string> = { month: '/mes', year: '/año' };

/** Precios vigentes del plan, mensual primero. */
export function activePlanPrices(plan: PlatformPlanDto) {
  return plan.prices
    .filter((price) => price.isActive)
    .sort((a, b) => (a.interval === b.interval ? 0 : a.interval === 'month' ? -1 : 1));
}

export function subscriptionsLabel(count: number): string {
  return `${count} ${count === 1 ? 'suscripción' : 'suscripciones'}`;
}
