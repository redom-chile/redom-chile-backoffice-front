/** Ítem con stock propio para elegir en compras y ajustes (ingrediente o producto con stockMode "direct"). */
export type StockableItem = Readonly<{
  productId: number;
  variationId: number;
  /** "Producto" o "Producto · Variación" cuando hay variaciones reales. */
  label: string;
  sku: string;
  kind: 'ingredient' | 'product';
  /** Unidad base del producto (puede faltar en productos antiguos). */
  unitId: number | null;
  /** Último costo de compra conocido de la variación, para sugerir. */
  defaultPurchasePrice: number | null;
}>;
