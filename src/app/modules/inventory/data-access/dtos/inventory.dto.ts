import { PaginationMeta, StandardizedPagination } from 'src/app/core/standarized-response';

export type { PaginationMeta, StandardizedPagination };

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'sale_reversal'
  | 'adjustment'
  | 'waste'
  | 'transfer_in'
  | 'transfer_out'
  | 'count'
  | 'production';

export type InventoryDocumentType = 'purchase' | 'adjustment';

export type AdjustmentReason = 'waste' | 'internal_use' | 'count_correction' | 'initial_stock' | 'other';

export type StockKind = 'ingredient' | 'product';

// ---------- Stock por local: GET /inventory/stock ----------
export type StockFiltersDto = Readonly<{
  locationId: number;
  search?: string;
  kind?: StockKind;
  lowStock?: boolean;
  page?: number;
  perPage?: number;
}>;

export type StockItemDto = Readonly<{
  productId: number;
  productName: string;
  sku: string;
  productType: string | null;
  variationId: number;
  variationName: string;
  unitId: number | null;
  unitName: string | null;
  /** En unidad base del producto. */
  qtyAvailable: number;
  /** Costo promedio ponderado por unidad base. */
  avgCost: number;
  stockValue: number;
  alertQuantity: number;
  isLowStock: boolean;
}>;

// ---------- Kardex: GET /inventory/movements ----------
export type StockMovementFiltersDto = Readonly<{
  locationId?: number;
  productId?: number;
  variationId?: number;
  documentId?: number;
  movementType?: StockMovementType;
  /** YYYY-MM-DD */
  dateFrom?: string;
  /** YYYY-MM-DD */
  dateTo?: string;
  page?: number;
  perPage?: number;
}>;

export type StockMovementDto = Readonly<{
  id: number;
  createdAt: string;
  locationId: number;
  locationName: string;
  productId: number;
  productName: string;
  variationId: number;
  variationName: string | null;
  unitName: string | null;
  movementType: StockMovementType;
  /** Con signo: + entrada, − salida (unidad base). */
  quantity: number;
  unitCost: number;
  totalCost: number;
  balanceAfter: number;
  documentId: number | null;
  // Pedido que generó el movimiento (venta, anulación o merma por anulación).
  transactionId: number | null;
  // Número del pedido ("FAC-00000012").
  invoiceNo?: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName?: string | null;
}>;

// ---------- Documentos: GET /inventory/documents ----------
export type InventoryDocumentFiltersDto = Readonly<{
  type?: InventoryDocumentType;
  reason?: AdjustmentReason;
  locationId?: number;
  supplierId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}>;

export type InventoryDocumentDto = Readonly<{
  id: number;
  type: InventoryDocumentType;
  reason: AdjustmentReason | null;
  locationId: number;
  locationName: string;
  supplierId: number | null;
  supplierName: string | null;
  referenceNo: string | null;
  /** YYYY-MM-DD */
  documentDate: string;
  notes: string | null;
  totalCost: number;
  linesCount: number;
  createdBy: string | null;
  createdAt: string;
}>;

// ---------- Compras: POST /inventory/purchases ----------
export type CreatePurchaseLineDto = Readonly<{
  variationId: number;
  /** > 0, en la unidad elegida (unitId) o en la del producto si se omite. */
  quantity: number;
  unitId?: number | null;
  /** Costo neto por la unidad elegida, >= 0. */
  unitCost: number;
}>;

export type CreatePurchaseDto = Readonly<{
  locationId: number;
  supplierId?: number | null;
  referenceNo?: string | null;
  documentDate?: string | null;
  notes?: string | null;
  lines: CreatePurchaseLineDto[];
}>;

export type InventoryMovementSummaryDto = Readonly<{
  variationId: number;
  /** Unidad base. */
  quantity: number;
  unitCost: number;
  balanceAfter: number;
}>;

export type InventoryDocumentResultDto = Readonly<{
  documentId: number;
  totalCost: number;
  movements: InventoryMovementSummaryDto[];
}>;

// ---------- Ajustes: POST /inventory/adjustments ----------
export type CreateAdjustmentLineDto = Readonly<{
  variationId: number;
  /** waste/internal_use/initial_stock: positiva. count_correction/other: + suma, − resta. Nunca 0. */
  quantity: number;
  unitId?: number | null;
  /** Solo en líneas que suman stock. */
  unitCost?: number | null;
}>;

export type CreateAdjustmentDto = Readonly<{
  locationId: number;
  reason: AdjustmentReason;
  documentDate?: string | null;
  notes?: string | null;
  lines: CreateAdjustmentLineDto[];
}>;
