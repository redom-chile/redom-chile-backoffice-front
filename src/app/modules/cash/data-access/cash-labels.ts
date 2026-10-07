import { CashMovementType, PaymentMethod } from './dtos';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferencia',
  other: 'Otro',
};

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  opening: 'Fondo inicial',
  sale: 'Cobro',
  refund: 'Devolución',
  cash_in: 'Ingreso de efectivo',
  cash_out: 'Retiro de efectivo',
  expense: 'Gasto',
};

/** Signo con que el movimiento afecta la caja. */
export function cashMovementSign(type: CashMovementType): 1 | -1 {
  return type === 'opening' || type === 'sale' || type === 'cash_in' ? 1 : -1;
}

/** Billetes y monedas de Chile para el arqueo. */
export const CLP_DENOMINATIONS: readonly number[] = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10];
