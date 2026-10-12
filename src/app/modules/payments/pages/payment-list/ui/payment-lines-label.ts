// Cantidades con decimales solo cuando los tienen (p. ej. 0,5 kg).
const quantityFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 });

export function formatQuantity(quantity: number): string {
  return quantityFormat.format(quantity);
}

// "2 × Coca-Cola, 1 × Hamburguesa"; vacío si el pago fue por monto.
export function paymentLinesLabel(
  lines: ReadonlyArray<{ quantity: number; productName?: string; sellLineId: number }> | null | undefined,
): string {
  return (lines ?? [])
    .map((line) => `${formatQuantity(line.quantity)} × ${line.productName ?? `Producto #${line.sellLineId}`}`)
    .join(', ');
}
