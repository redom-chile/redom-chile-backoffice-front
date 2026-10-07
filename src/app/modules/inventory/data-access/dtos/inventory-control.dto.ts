// ---------- Food cost: GET /inventory/food-cost (arreglo sin paginar, ordenado por % de mayor a menor) ----------
export type FoodCostFiltersDto = Readonly<{
  // Sin local: promedio del negocio ponderado por el stock de cada local.
  locationId?: number;
  // Nombre o SKU (máx. 100).
  search?: string;
  categoryId?: number;
}>;

/** Una fila por variación de platos con receta y productos con stock propio (sin modificadores ni ingredientes). */
export type FoodCostItemDto = Readonly<{
  productId: number;
  productName: string;
  variationId: number;
  variationName: string | null;
  itemName: string;
  categoryId: number | null;
  categoryName: string | null;
  stockMode: 'recipe' | 'direct';
  // Plato sin ingredientes en su receta.
  missingRecipe: boolean;
  // Algún insumo sin costo (falta una compra con costo): el % queda subestimado.
  missingCost: boolean;
  priceIncTax: number | null;
  // Precio sin IVA.
  netPrice: number | null;
  cost: number;
  // null si no tiene precio.
  foodCostPercent: number | null;
  // Precio sin IVA − costo.
  margin: number | null;
}>;

// ---------- Conteo físico: POST /inventory/counts ----------
export type CreateCountLineDto = Readonly<{
  variationId: number;
  // ≥ 0 (0 = no queda nada), máx. 4 decimales, en unitId o en la unidad base.
  countedQuantity: number;
  unitId?: number | null;
}>;

export type CreateCountDto = Readonly<{
  locationId: number;
  // YYYY-MM-DD; por defecto hoy.
  documentDate?: string | null;
  notes?: string | null;
  // 1..500, sin ítems repetidos. Solo productos con stock propio e ingredientes.
  lines: CreateCountLineDto[];
}>;

export type CountResultLineDto = Readonly<{
  variationId: number;
  // Cantidades en la unidad base.
  systemQuantity: number;
  countedQuantity: number;
  // Contado − sistema (negativa = faltante).
  difference: number;
  unitCost: number;
  differenceValue: number;
}>;

export type CountResultDto = Readonly<{
  documentId: number;
  // Negativo = valor perdido.
  netDifferenceValue: number;
  linesWithDifference: number;
  // Mismo orden que las líneas enviadas; incluye las sin diferencia.
  lines: CountResultLineDto[];
}>;

// ---------- Transferencias: POST /inventory/transfers ----------
export type CreateTransferLineDto = Readonly<{
  variationId: number;
  // > 0, máx. 4 decimales, en unitId o en la unidad base.
  quantity: number;
  unitId?: number | null;
}>;

export type CreateTransferDto = Readonly<{
  fromLocationId: number;
  toLocationId: number;
  documentDate?: string | null;
  notes?: string | null;
  // 1..200, sin ítems repetidos.
  lines: CreateTransferLineDto[];
}>;

export type TransferResultDto = Readonly<{
  documentId: number;
  totalCost: number;
  lines: ReadonlyArray<{
    variationId: number;
    quantity: number;
    // Costo promedio del origen.
    unitCost: number;
    fromBalanceAfter: number;
    toBalanceAfter: number;
  }>;
}>;

// ---------- Consumo teórico vs real: GET /inventory/consumption ----------
export type ConsumptionFiltersDto = Readonly<{
  locationId: number;
  // YYYY-MM-DD en la zona del negocio; por defecto, del día 1 del mes a hoy. Usa la fecha en que se registró el movimiento.
  dateFrom?: string;
  dateTo?: string;
  productId?: number;
}>;

/** Cantidades en la unidad base; salidas en positivo. Solo ítems con movimientos en el período. */
export type ConsumptionItemDto = Readonly<{
  productId: number;
  variationId: number;
  itemName: string;
  productType: string | null;
  unitName: string | null;
  opening: number;
  purchases: number;
  transfersIn: number;
  transfersOut: number;
  adjustments: number;
  produced?: number;
  usedInProduction?: number;
  // Lo que las ventas debieron consumir según las recetas.
  theoreticalConsumption: number;
  waste: number;
  // + sobrante / − faltante (conteos y correcciones por conteo).
  countDifference: number;
  realConsumption: number;
  closing: number;
  // Mermas − diferencia de conteo: lo que se perdió.
  variance: number;
  theoreticalValue: number;
  varianceValue: number;
}>;

export type ConsumptionReportDto = Readonly<{
  locationId: number;
  dateFrom: string;
  dateTo: string;
  totals: Readonly<{
    theoreticalValue: number;
    // Positivo.
    wasteValue: number;
    // Negativo = faltante.
    countDifferenceValue: number;
    varianceValue: number;
  }>;
  items: ConsumptionItemDto[];
}>;
