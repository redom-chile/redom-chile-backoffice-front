import { ExpenseDocumentType, ExpenseStatus, PayableType, RecurringFrequency } from './dtos';

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagado',
  cancelled: 'Anulado',
};

export const EXPENSE_STATUS_CLASSES: Record<ExpenseStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  partial: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  paid: 'bg-green-500/15 text-green-700 dark:text-green-400',
  cancelled: 'bg-[var(--muted)] text-muted-foreground line-through',
};

export const EXPENSE_DOCUMENT_LABELS: Record<ExpenseDocumentType, string> = {
  invoice: 'Factura',
  receipt: 'Boleta',
  none: 'Sin documento',
};

export const PAYABLE_TYPE_LABELS: Record<PayableType, string> = { expense: 'Gasto', purchase: 'Compra' };

export const WEEKDAY_LABELS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

/** "Cada mes el día 5" · "Cada viernes". */
export function recurrenceLabel(frequency: RecurringFrequency, dayOfPeriod: number): string {
  if (frequency === 'weekly') return `Cada ${WEEKDAY_LABELS[(dayOfPeriod - 1 + 7) % 7]}`;
  return dayOfPeriod >= 31 ? 'Cada mes el último día' : `Cada mes el día ${dayOfPeriod}`;
}

/** IVA sugerido para un monto con IVA (19 %): round(amount × 19 / 119). */
export function suggestedVat(amount: number, vatRate = 19, decimals = 0): number {
  if (!amount || amount <= 0) return 0;
  const factor = 10 ** decimals;
  return Math.round(((amount * vatRate) / (100 + vatRate)) * factor) / factor;
}

/** "vence en 3 días" · "vence hoy" · "vencida hace 2 días". */
export function dueLabel(daysToDue: number): string {
  if (daysToDue === 0) return 'vence hoy';
  if (daysToDue > 0) return `vence en ${daysToDue} ${daysToDue === 1 ? 'día' : 'días'}`;
  const days = Math.abs(daysToDue);
  return `vencida hace ${days} ${days === 1 ? 'día' : 'días'}`;
}
