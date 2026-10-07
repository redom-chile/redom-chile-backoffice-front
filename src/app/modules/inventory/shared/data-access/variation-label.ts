/** 'DUMMY' es la variación única de un producto sin variaciones reales: no se muestra. */
export function variationLabel(name: string | null | undefined): string | null {
  return name && name !== 'DUMMY' ? name : null;
}

/** "Producto" o "Producto · Variación". */
export function productLabel(productName: string, variationName?: string | null): string {
  const variation = variationLabel(variationName);
  return variation ? `${productName} · ${variation}` : productName;
}
