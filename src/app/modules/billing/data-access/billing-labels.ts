import { BillingPaymentMethod, BillingPaymentStatus, CheckoutAction, InvoiceStatus, PlanInterval } from './dtos';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido', void: 'Anulado' };
export const INVOICE_STATUS_TONES: Record<InvoiceStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  paid: 'bg-green-500/15 text-green-700 dark:text-green-400',
  overdue: 'bg-red-500/15 text-red-700 dark:text-red-400',
  void: 'bg-[var(--muted)] text-muted-foreground',
};
export const PAYMENT_STATUS_LABELS: Record<BillingPaymentStatus, string> = { pending: 'En revisión', confirmed: 'Confirmado', rejected: 'Rechazado' };
export const PAYMENT_STATUS_TONES: Record<BillingPaymentStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  confirmed: 'bg-green-500/15 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400',
};
export const PAYMENT_METHOD_LABELS: Record<BillingPaymentMethod, string> = {
  transfer: 'Transferencia',
  cash: 'Efectivo',
  other: 'Otro',
  flow_card: 'Tarjeta (Flow)',
  flow_other: 'Flow',
};
export const PAYMENT_KIND_LABELS = { payment: 'Pago', refund: 'Reembolso', reversal: 'Reverso' } as const;
export const INTERVAL_LABELS: Record<PlanInterval, string> = { month: 'Mensual', year: 'Anual' };
export const INTERVAL_SUFFIX: Record<PlanInterval, string> = { month: '/mes', year: '/año' };
export const CHECKOUT_ACTION_TITLES: Record<CheckoutAction, string> = {
  purchase: 'Nuevo plan',
  renewal: 'Renovación',
  upgrade: 'Mejora de plan',
  scheduled: 'Cambio programado',
};

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
export const formatClp = (amount: number | null | undefined) => (amount === null || amount === undefined ? '—' : CLP.format(amount));
