export type StockDeductionMoment = 'on_order' | 'on_payment';

/** Campos de GET /business/:id/settings que usa el front (el backend devuelve más). */
export type BusinessSettingsDto = Readonly<{
  id: number;
  name: string;
  inventoryEnabled?: boolean;
  deductStockOnSale?: boolean;
  ingredientsEnabled?: boolean;
  stockDeductionMoment?: StockDeductionMoment;
  allowNegativeStock?: boolean;
  quantityPrecision?: number;
  currencyPrecision?: number;
}>;

export type InventorySettings = Readonly<{
  inventoryEnabled: boolean;
  deductStockOnSale: boolean;
  ingredientsEnabled: boolean;
  stockDeductionMoment: StockDeductionMoment;
  allowNegativeStock: boolean;
}>;

/** PATCH /business/:id/settings: solo los campos cambiados. */
export type UpdateInventorySettingsDto = Partial<InventorySettings>;
