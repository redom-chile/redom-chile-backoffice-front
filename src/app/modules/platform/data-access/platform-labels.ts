import { SubscriptionStatus } from 'src/app/core/services/entitlements';
import { BillingMethod, DiscountDuration, PlanInterval } from './dtos';

export const PLATFORM_TIME_ZONE = 'America/Santiago';

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus | 'none', string> = {
  trialing: 'En prueba',
  active: 'Activa',
  past_due: 'Pago atrasado',
  expired: 'Vencida',
  cancelled: 'Cancelada',
  none: 'Sin suscripción',
};

/** Clases del badge de cada estado (funcionan en claro y oscuro). */
export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus | 'none', string> = {
  trialing: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  active: 'bg-green-500/15 text-green-700 dark:text-green-400',
  past_due: 'bg-red-500/15 text-red-700 dark:text-red-400',
  expired: 'bg-[var(--muted)] text-muted-foreground',
  cancelled: 'bg-[var(--muted)] text-muted-foreground',
  none: 'bg-[var(--muted)] text-muted-foreground',
};

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = { none: 'Sin medio', flow: 'Flow (tarjeta)', manual: 'Pago manual' };
export const INTERVAL_LABELS: Record<PlanInterval, string> = { month: 'Mensual', year: 'Anual' };
export const DISCOUNT_DURATION_LABELS: Record<DiscountDuration, string> = { once: 'Un cobro', repeating: 'Varios cobros', forever: 'Para siempre' };

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
export const formatClp = (amount: number | null | undefined) => (amount === null || amount === undefined ? '—' : CLP.format(amount));

/** Fecha (y hora) en America/Santiago. */
export function formatPlatformDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: PLATFORM_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

/** Fin del día elegido (YYYY-MM-DD) en America/Santiago, como ISO para el backend (respeta el horario de verano). */
export function endOfDayInSantiago(date: string): string {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: PLATFORM_TIME_ZONE, timeZoneName: 'longOffset' })
    .formatToParts(noonUtc)
    .find((part) => part.type === 'timeZoneName')?.value.replace('GMT', '');
  return new Date(`${date}T23:59:59${offset || '-03:00'}`).toISOString();
}

/** YYYY-MM-DD de una fecha ISO en America/Santiago (para los inputs de fecha). */
export function toSantiagoDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIME_ZONE }).format(date);
}
