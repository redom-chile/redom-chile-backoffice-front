import { BillingPaymentMethod, BillingPaymentStatus, INTERVAL_LABELS, PlanInterval } from 'src/app/modules/billing/data-access';
import { formatPlatformDate, PLATFORM_TIME_ZONE } from '../../data-access';

/** Pago al que se le aplica una acción (confirmar, rechazar o reversar). */
export type PaymentTarget = Readonly<{
  id: number;
  amount: number;
  method: BillingPaymentMethod;
  reference: string | null;
  businessName: string;
}>;

/** Cobro en el que se registra un pago. */
export type InvoiceTarget = Readonly<{
  id: number;
  businessName: string;
  /** "Emprende · Mensual · 01 oct 2026 → 01 nov 2026". */
  label: string;
  total: number;
  /** Pagos confirmados menos reversos. */
  paidAmount: number;
  /** Transferencias en revisión. */
  pendingAmount: number;
}>;

type PaymentLike = Readonly<{
  id: number;
  invoiceId: number;
  kind: 'payment' | 'refund' | 'reversal';
  status: BillingPaymentStatus;
  amount: number;
  reversesPaymentId: number | null;
}>;

export const INVOICE_KIND_LABELS: Record<'period' | 'proration', string> = { period: 'Período', proration: 'Prorrateo' };

/** Los reembolsos y reversos restan. */
export const signedAmount = (payment: Pick<PaymentLike, 'kind' | 'amount'>) => (payment.kind === 'payment' ? payment.amount : -payment.amount);

/** Se puede reversar: pago confirmado (kind payment) que todavía no tiene reverso. */
export function isReversible(payment: PaymentLike, all: readonly PaymentLike[]): boolean {
  return payment.kind === 'payment' && payment.status === 'confirmed' && !all.some((other) => other.reversesPaymentId === payment.id);
}

/** Pagado (confirmados − reversos) y en revisión de un cobro, a partir de sus pagos. */
export function invoiceAmounts(invoiceId: number, payments: readonly PaymentLike[]): Readonly<{ paidAmount: number; pendingAmount: number }> {
  let paidAmount = 0;
  let pendingAmount = 0;
  for (const payment of payments) {
    if (payment.invoiceId !== invoiceId) continue;
    if (payment.status === 'confirmed') paidAmount += signedAmount(payment);
    else if (payment.status === 'pending' && payment.kind === 'payment') pendingAmount += payment.amount;
  }
  return { paidAmount, pendingAmount };
}

export function invoiceLabel(invoice: Readonly<{ plan?: { name: string } | null; interval?: PlanInterval | null; periodStart: string; periodEnd: string; kind: 'period' | 'proration' }>): string {
  const parts: string[] = [];
  if (invoice.plan?.name) parts.push(invoice.plan.name);
  if (invoice.interval) parts.push(INTERVAL_LABELS[invoice.interval]);
  if (invoice.kind === 'proration') parts.push(INVOICE_KIND_LABELS.proration);
  parts.push(`${formatPlatformDate(invoice.periodStart)} → ${formatPlatformDate(invoice.periodEnd)}`);
  return parts.join(' · ');
}

// --- Fechas en America/Santiago ---

/** Fecha (YYYY-MM-DD) y hora (HH:mm) actuales en America/Santiago. */
export function nowInSantiago(): Readonly<{ date: string; time: string }> {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIME_ZONE }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: PLATFORM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return { date, time };
}

/** ISO de una fecha y hora de Chile (respeta el horario de verano). */
export function santiagoDateTimeToIso(date: string, time: string): string {
  const probe = new Date(`${date}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: PLATFORM_TIME_ZONE, timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((part) => part.type === 'timeZoneName')
    ?.value.replace('GMT', '');
  return new Date(`${date}T${time}:00${offset || '-03:00'}`).toISOString();
}

/** Días entre dos fechas YYYY-MM-DD, contando ambas. */
export function daysInRange(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Descarga un Blob como archivo (link temporal que se libera después). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
