import { PaymentMethod } from './payment.dto';

/** Producto (línea del pedido) que cubre un pago; sus modificadores van incluidos. */
export type PaymentLineInputDto = Readonly<{
  sellLineId: number;
  // 0 < quantity ≤ pendingQuantity de la línea.
  quantity: number;
}>;

export type PaymentLineDto = Readonly<{
  sellLineId: number;
  // Solo en el historial (GET /payments?transactionId=).
  productName?: string;
  quantity: number;
  amount: number;
}>;

export type CreatePaymentDto = Readonly<{
  transactionId: number;
  // Obligatorio en pagos por monto. Con `lines` se omite: lo calcula el backend.
  amount?: number;
  // Pago por productos (dividir la cuenta).
  lines?: PaymentLineInputDto[];
  method: PaymentMethod;
  tipAmount?: number;
  // Solo para efectivo: debe cubrir amount + tipAmount.
  amountTendered?: number;
  note?: string;
}>;

export type CreatePaymentResponseDto = Readonly<{
  id: number;
  success: boolean;
  // Monto cobrado (el calculado por el backend en pagos por productos).
  amount?: number;
  lines?: PaymentLineDto[];
  changeAmount: number;
  paymentStatus: 'due' | 'partial' | 'paid';
  remaining: number;
}>;

export type CancelPaymentDto = Readonly<{
  id: number;
  reason: string;
}>;
