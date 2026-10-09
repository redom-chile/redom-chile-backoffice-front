import { computed, inject, Pipe, PipeTransform, Signal } from '@angular/core';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { SubscriptionStatus } from 'src/app/core/services/entitlements';
import { InvoiceWithPaymentsDto, OwnerSubscriptionDto, PlanInterval } from '../../data-access';

export const DEFAULT_TIME_ZONE = 'America/Santiago';

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'En prueba',
  active: 'Activa',
  past_due: 'Pago atrasado',
  expired: 'Vencida',
  cancelled: 'Cancelada',
};

export const SUBSCRIPTION_STATUS_TONES: Record<SubscriptionStatus, string> = {
  trialing: 'bg-primary/10 text-primary',
  active: 'bg-green-500/15 text-green-700 dark:text-green-400',
  past_due: 'bg-red-500/15 text-red-700 dark:text-red-400',
  expired: 'bg-[var(--muted)] text-muted-foreground',
  cancelled: 'bg-[var(--muted)] text-muted-foreground',
};

export const DISCOUNT_DURATION_LABELS = { once: 'en un cobro', repeating: 'por varios cobros', forever: 'en todos los cobros' } as const;

export function validTimeZone(zone: string | null | undefined): string {
  if (!zone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Zona horaria del negocio (válida), para mostrar las fechas del cobro. */
export function injectBillingTimeZone(): Signal<string> {
  const settings = inject(BusinessSettingsService);
  return computed(() => validTimeZone(settings.$settings()?.timeZone));
}

export type BillingDateStyle = 'long' | 'short' | 'datetime';

const DATE_OPTIONS: Record<BillingDateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
};

export function formatBillingDate(value: string | null | undefined, timeZone: string, style: BillingDateStyle = 'long'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CL', { ...DATE_OPTIONS[style], timeZone: validTimeZone(timeZone) });
}

/** {{ value | billingDate: timeZone : 'short' }} */
@Pipe({ name: 'billingDate' })
export class BillingDatePipe implements PipeTransform {
  transform(value: string | null | undefined, timeZone: string, style: BillingDateStyle = 'long'): string {
    return formatBillingDate(value, timeZone, style);
  }
}

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const result: Record<string, number> = {};
  for (const part of parts) if (part.type !== 'literal') result[part.type] = Number(part.value);
  return result;
}

/** Minutos que la zona está adelantada respecto de UTC en ese instante (Chile: -180 o -240). */
function offsetMinutes(utcMs: number, timeZone: string): number {
  const instant = Math.floor(utcMs / 1000) * 1000;
  const p = zonedParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(p['year'], p['month'] - 1, p['day'], p['hour'] % 24, p['minute'], p['second']);
  return Math.round((asUtc - instant) / 60000);
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Fecha (YYYY-MM-DD) y hora (HH:mm) actuales en la zona del negocio, para los inputs. */
export function nowInZone(timeZone: string): Readonly<{ date: string; time: string }> {
  const p = zonedParts(new Date(), validTimeZone(timeZone));
  return { date: `${p['year']}-${pad(p['month'])}-${pad(p['day'])}`, time: `${pad(p['hour'] % 24)}:${pad(p['minute'])}` };
}

/** "2026-10-08" + "10:30" en la zona del negocio → "2026-10-08T10:30:00-03:00". */
export function zonedIso(date: string, time: string, timeZone: string): string | null {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const zone = validTimeZone(timeZone);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let offset = offsetMinutes(guess, zone);
  const corrected = offsetMinutes(guess - offset * 60000, zone);
  if (corrected !== offset) offset = corrected;
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${date}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Lo que falta pagar de un cobro (sin contar lo que está en revisión). */
export const invoiceBalance = (invoice: InvoiceWithPaymentsDto) => Math.max(0, invoice.total - invoice.paidAmount);

/** Lo que todavía se puede informar: falta pagar menos lo que está en revisión. */
export const invoiceReportable = (invoice: InvoiceWithPaymentsDto) =>
  Math.max(0, invoice.total - invoice.paidAmount - invoice.pendingAmount);

export function invoiceTitle(invoice: Pick<InvoiceWithPaymentsDto, 'kind' | 'plan' | 'interval'>, intervalLabels: Record<PlanInterval, string>): string {
  if (invoice.kind === 'proration') return `Diferencia por mejora de plan (${invoice.plan.name})`;
  return `Plan ${invoice.plan.name} ${intervalLabels[invoice.interval].toLowerCase()}`;
}

export type CheckoutPreview = 'purchase' | 'renewal' | 'upgrade' | 'scheduled';

/**
 * Lo que va a hacer el checkout (misma regla que el backend, owner-billing.service.ts):
 * sin período pagado vigente → purchase; mismo precio → renewal; más caro del mismo intervalo → upgrade;
 * más barato u otro intervalo → scheduled.
 */
export function previewCheckout(
  subscription: OwnerSubscriptionDto | null,
  price: Readonly<{ id: number; interval: PlanInterval; amount: number }>,
): CheckoutPreview {
  const current = subscription?.price ?? null;
  const end = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).getTime() : NaN;
  const paying =
    !!subscription &&
    current !== null &&
    (subscription.status === 'active' || subscription.status === 'past_due') &&
    !!subscription.currentPeriodStart &&
    Number.isFinite(end) &&
    end > Date.now();
  if (!paying || !current) return 'purchase';
  if (price.id === current.id) return 'renewal';
  if (price.interval === current.interval && price.amount > current.amount) return 'upgrade';
  return 'scheduled';
}
