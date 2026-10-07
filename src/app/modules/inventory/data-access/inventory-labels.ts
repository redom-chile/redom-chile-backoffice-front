import { AdjustmentReason, InventoryDocumentType, StockMovementType } from './dtos';

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  purchase: 'Compra',
  sale: 'Venta',
  sale_reversal: 'Reversa de venta',
  adjustment: 'Ajuste',
  waste: 'Merma',
  transfer_in: 'Transferencia',
  transfer_out: 'Transferencia',
  count: 'Conteo',
  production: 'Producción',
};

export const MOVEMENT_TYPE_OPTIONS: ReadonlyArray<{ value: StockMovementType; label: string }> = [
  { value: 'purchase', label: 'Compra' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'waste', label: 'Merma' },
  { value: 'count', label: 'Conteo' },
  { value: 'sale', label: 'Venta' },
  { value: 'sale_reversal', label: 'Reversa de venta' },
  { value: 'transfer_in', label: 'Transferencia (entrada)' },
  { value: 'transfer_out', label: 'Transferencia (salida)' },
];

export const DOCUMENT_TYPE_LABELS: Record<InventoryDocumentType, string> = {
  purchase: 'Compra',
  adjustment: 'Ajuste',
};

export type AdjustmentReasonOption = Readonly<{
  value: AdjustmentReason;
  label: string;
  hint: string;
  /** exit: cantidad positiva que descuenta · entry: positiva que suma · signed: + suma / − resta */
  direction: 'exit' | 'entry' | 'signed';
  /** Nota obligatoria en la UI. */
  requiresNotes: boolean;
}>;

export const ADJUSTMENT_REASONS: readonly AdjustmentReasonOption[] = [
  { value: 'waste', label: 'Merma', hint: 'Vencido, dañado o se cayó. Se descuenta del stock.', direction: 'exit', requiresNotes: true },
  { value: 'internal_use', label: 'Consumo interno', hint: 'Comida del personal o degustación. Se descuenta del stock.', direction: 'exit', requiresNotes: false },
  { value: 'initial_stock', label: 'Stock inicial', hint: 'Lo que tienes al empezar a usar el inventario. Suma al stock; el costo es opcional y fija el costo promedio.', direction: 'entry', requiresNotes: false },
  { value: 'count_correction', label: 'Corrección por conteo', hint: 'Después de contar: usa + para sumar y − para restar la diferencia.', direction: 'signed', requiresNotes: false },
  { value: 'other', label: 'Otro', hint: 'Usa + para sumar y − para restar. Explica el motivo en la nota.', direction: 'signed', requiresNotes: true },
];

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = Object.fromEntries(
  ADJUSTMENT_REASONS.map((reason) => [reason.value, reason.label]),
) as Record<AdjustmentReason, string>;

export const STOCK_MODE_OPTIONS = [
  { value: 'none', label: 'Sin control', hint: 'No controla stock (servicio, propina).' },
  { value: 'direct', label: 'Stock propio', hint: 'El producto tiene stock propio (bebida en lata, cerveza).' },
  { value: 'recipe', label: 'Por receta', hint: 'Descuenta ingredientes según su receta (plato). Las recetas llegan pronto.' },
] as const;

export type StockMode = (typeof STOCK_MODE_OPTIONS)[number]['value'];

export const STOCK_MODE_LABELS: Record<StockMode, string> = {
  none: 'Sin control',
  direct: 'Stock propio',
  recipe: 'Por receta',
};
