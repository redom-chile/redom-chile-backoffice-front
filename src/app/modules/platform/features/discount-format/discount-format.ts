import {
  DISCOUNT_DURATION_LABELS,
  DiscountDto,
  endOfDayInSantiago,
  formatClp,
  formatPlatformDate,
  INTERVAL_LABELS,
  PlatformPlanDto,
} from '../../data-access';

/** Cupón: 2 a 40 letras, números, - o _, empieza con letra o número (se guarda en mayúsculas). */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

const PERCENT = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

export function formatDiscountValue(discount: Pick<DiscountDto, 'type' | 'value'>): string {
  return discount.type === 'percent' ? `${PERCENT.format(discount.value)} %` : formatClp(discount.value);
}

export function formatDiscountDuration(discount: Pick<DiscountDto, 'duration' | 'durationPeriods'>): string {
  if (discount.duration === 'repeating' && discount.durationPeriods) {
    return `${discount.durationPeriods} ${discount.durationPeriods === 1 ? 'cobro' : 'cobros'}`;
  }
  return DISCOUNT_DURATION_LABELS[discount.duration];
}

/** Restricciones en una línea: planes, intervalos y negocios. */
export function formatDiscountRestrictions(discount: DiscountDto, plans: readonly PlatformPlanDto[]): string[] {
  const parts: string[] = [];
  if (discount.planIds?.length) {
    const names = discount.planIds.map((id) => plans.find((plan) => plan.id === id)?.name ?? `Plan #${id}`);
    parts.push(names.join(', '));
  } else {
    parts.push('Todos los planes');
  }
  parts.push(discount.intervals?.length === 1 ? `Solo ${INTERVAL_LABELS[discount.intervals[0]].toLowerCase()}` : 'Mensual y anual');
  if (discount.businessIds?.length) {
    const count = discount.businessIds.length;
    parts.push(`Exclusivo de ${count} ${count === 1 ? 'negocio' : 'negocios'}`);
  }
  return parts;
}

export type DiscountValidity = Readonly<{ label: string; state: 'upcoming' | 'current' | 'expired' }>;

export function discountValidity(discount: Pick<DiscountDto, 'validFrom' | 'validUntil'>, now = Date.now()): DiscountValidity {
  const from = discount.validFrom ? Date.parse(discount.validFrom) : null;
  const until = discount.validUntil ? Date.parse(discount.validUntil) : null;
  const state = from !== null && from > now ? 'upcoming' : until !== null && until < now ? 'expired' : 'current';
  if (from === null && until === null) return { label: 'Sin límite de fechas', state };
  if (from === null) return { label: `Hasta el ${formatPlatformDate(discount.validUntil)}`, state };
  if (until === null) return { label: `Desde el ${formatPlatformDate(discount.validFrom)}`, state };
  return { label: `${formatPlatformDate(discount.validFrom)} – ${formatPlatformDate(discount.validUntil)}`, state };
}

/** Usado (o asignado a una suscripción): sus términos ya no cambian (409 DISCOUNT_IN_USE). */
export function discountIsLocked(discount: Pick<DiscountDto, 'redemptions' | 'subscriptions'>): boolean {
  return discount.redemptions > 0 || discount.subscriptions > 0;
}

/** Inicio del día elegido (YYYY-MM-DD) en America/Santiago, como ISO: un segundo después del fin del día anterior. */
export function startOfDayInSantiago(date: string): string {
  const previous = new Date(`${date}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const end = Date.parse(endOfDayInSantiago(previous.toISOString().slice(0, 10)));
  return new Date(end + 1000).toISOString();
}
