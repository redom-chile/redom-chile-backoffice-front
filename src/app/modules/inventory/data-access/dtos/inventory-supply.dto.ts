// ---------- Lotes y vencimientos ----------

/** Campos opcionales de lote en las entradas (compras, recepciones, producciones, ajustes que suman). */
export type LotFieldsDto = Readonly<{
  // Máx. 100; vacío = sin número.
  lotNumber?: string | null;
  // YYYY-MM-DD.
  expiryDate?: string | null;
}>;

export type LotStatusFilter = 'active' | 'expiring' | 'expired';
export type LotStatus = 'expired' | 'expiring' | 'ok' | 'no_expiry';

export type StockLotFiltersDto = Readonly<{
  locationId?: number;
  productId?: number;
  variationId?: number;
  // Por defecto active.
  status?: LotStatusFilter;
  // Días para "por vencer" (1..365, por defecto 7).
  days?: number;
}>;

/** GET /inventory/lots: arreglo sin paginar, solo lotes con saldo, el que vence antes primero. */
export type StockLotDto = Readonly<{
  id: number;
  locationId: number;
  locationName: string;
  productId: number;
  variationId: number;
  itemName: string;
  unitName: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  // Negativo si ya venció.
  daysToExpiry: number | null;
  status: LotStatus;
  initialQuantity: number;
  // Saldo en unidad base.
  quantity: number;
  unitCost: number;
  value: number;
  documentId: number | null;
  createdAt: string;
}>;

// ---------- Producción de preparaciones: POST /inventory/productions ----------
export type CreateProductionDto = Readonly<
  {
    locationId: number;
    // Variación de la preparación (ingrediente con receta de producción).
    variationId: number;
    // > 0, en unitId o en la unidad base.
    quantity: number;
    unitId?: number | null;
    documentDate?: string | null;
    notes?: string | null;
  } & LotFieldsDto
>;

export type ProductionResultDto = Readonly<{
  documentId: number;
  // Unidad base.
  producedQuantity: number;
  // Tandas = producido / rinde.
  batches: number;
  totalCost: number;
  unitCost: number;
  balanceAfter: number;
  // Cantidad NEGATIVA en unidad base.
  consumed: ReadonlyArray<{ variationId: number; quantity: number; unitCost: number; balanceAfter: number }>;
}>;

// ---------- Órdenes de compra: /inventory/purchase-orders ----------
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export type PurchaseOrderFiltersDto = Readonly<{
  status?: PurchaseOrderStatus;
  locationId?: number;
  supplierId?: number;
  // Fecha de la orden, YYYY-MM-DD.
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  // Máx. 100 (el backend no acepta `limit`).
  perPage?: number;
}>;

export type PurchaseOrderListItemDto = Readonly<{
  id: number;
  status: PurchaseOrderStatus;
  locationId: number;
  locationName: string;
  supplierId: number | null;
  supplierName: string | null;
  referenceNo: string | null;
  orderDate: string;
  expectedDate: string | null;
  totalCost: number;
  linesCount: number;
  // 0..100.
  receivedPercent: number;
  createdAt: string;
}>;

export type PurchaseOrderLineDto = Readonly<{
  // lineId para recibir.
  id: number;
  productId: number;
  variationId: number;
  itemName: string;
  // Unidad elegida en la orden (o la del producto).
  unitId: number | null;
  unitName: string | null;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  baseUnitName: string | null;
  baseQuantity: number;
  receivedBaseQuantity: number;
  // Nunca menor que 0.
  pendingBaseQuantity: number;
}>;

export type PurchaseOrderReceptionDto = Readonly<{
  // Compra creada al recibir (kardex con ?documentId=).
  documentId: number;
  documentDate: string;
  referenceNo: string | null;
  totalCost: number;
  createdAt: string;
}>;

/** Detalle: lo devuelven GET /:id, POST, PUT, PATCH status y POST receive. */
export type PurchaseOrderDto = Readonly<{
  id: number;
  status: PurchaseOrderStatus;
  locationId: number;
  locationName: string;
  supplierId: number | null;
  supplierName: string | null;
  referenceNo: string | null;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  totalCost: number;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLineDto[];
  receptions: PurchaseOrderReceptionDto[];
}>;

export type PurchaseOrderLineInputDto = Readonly<{
  variationId: number;
  // > 0, en unitId o en la unidad base.
  quantity: number;
  unitId?: number | null;
  // ≥ 0 por la unidad elegida; por defecto 0.
  unitCost?: number | null;
}>;

export type SavePurchaseOrderDto = Readonly<{
  locationId: number;
  supplierId?: number | null;
  referenceNo?: string | null;
  // Por defecto hoy (en PUT, si se omite vuelve a hoy).
  orderDate?: string | null;
  expectedDate?: string | null;
  notes?: string | null;
  // 1..200, sin ítems repetidos.
  lines: PurchaseOrderLineInputDto[];
}>;

/** POST: borrador o enviada. PUT usa el mismo cuerpo sin status (solo draft/sent). */
export type CreatePurchaseOrderDto = SavePurchaseOrderDto & Readonly<{ status?: 'draft' | 'sent' }>;

export type PurchaseOrderStatusChange = 'draft' | 'sent' | 'cancelled';

export type ReceivePurchaseOrderDto = Readonly<{
  referenceNo?: string | null;
  documentDate?: string | null;
  notes?: string | null;
  // 1..200; quantity > 0 en la unidad de la línea (se puede recibir más de lo pedido).
  lines: ReadonlyArray<
    {
      lineId: number;
      quantity: number;
      // Por defecto, el costo de la orden.
      unitCost?: number | null;
    } & LotFieldsDto
  >;
}>;
