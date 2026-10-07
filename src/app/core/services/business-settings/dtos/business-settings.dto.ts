export type StockDeductionMoment = 'on_order' | 'on_payment';
/** includes: el precio del producto incluye IVA; excludes: es neto y el IVA se suma al vender. */
export type SellPriceTax = 'includes' | 'excludes';

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
  currencyId?: number;
  timeZone?: string | null;
  // Datos fiscales: etiqueta (RUT) y número del negocio.
  taxLabel1?: string | null;
  taxNumber1?: string | null;
  // IVA en %, por defecto 19.
  vatRate?: number;
  sellPriceTax?: SellPriceTax;
  // Siempre true; solo lo usa la carta pública (QR). No usarlo para decidir el flujo.
  isActive?: boolean;
  logoUrl?: string | null;
  // El GET lo devuelve como texto JSON (snake_case); el servicio lo normaliza a objeto.
  posSettings?: PosSettings | null;
  // Propina sugerida en el cobro (0 = sin sugerencia).
  suggestedTipPercent?: number | null;
}>;

/** Opciones del POS (PATCH parcial: solo cambian las que se envían). */
export type PosSettings = Readonly<{
  tablesEnabled?: boolean;
  waiterEnabled?: boolean;
  isServiceStaffRequired?: boolean;
}>;

/** PATCH /business/:id/settings con los datos generales (todos opcionales). */
export type UpdateBusinessSettingsDto = Partial<
  Readonly<{
    name: string;
    currencyId: number;
    timeZone: string;
    taxLabel1: string | null;
    taxNumber1: string | null;
    vatRate: number;
    sellPriceTax: SellPriceTax;
    currencyPrecision: number;
    posSettings: PosSettings;
    suggestedTipPercent: number;
  }>
>;

export type InventorySettings = Readonly<{
  inventoryEnabled: boolean;
  deductStockOnSale: boolean;
  ingredientsEnabled: boolean;
  stockDeductionMoment: StockDeductionMoment;
  allowNegativeStock: boolean;
}>;

/** PATCH /business/:id/settings: solo los campos cambiados. */
export type UpdateInventorySettingsDto = Partial<InventorySettings>;
