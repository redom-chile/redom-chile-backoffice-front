export type ProductVariationDto = Readonly<{
  id: number;
  name: string;
  productId: number;
  subSku: string | null;
  productVariationId: number;
  defaultPurchasePrice: number | null;
  dppIncTax: number;
  profitPercent: number;
  defaultSellPrice: number | null;
  sellPriceIncTax: number | null;
  isActive: boolean;
}>;

/** none: sin control · direct: stock propio · recipe: descuenta ingredientes por receta. */
export type ProductStockMode = 'none' | 'direct' | 'recipe';

export type ProductDto = Readonly<{
  id: number;
  name: string;
  businessId: number;
  // 'ingredient' para ingredientes (GET /products sin type ya no los devuelve).
  type: string | null;
  stockMode?: ProductStockMode;
  // Unidad base del stock (obligatoria en ingredientes, opcional en productos con stock propio).
  unitId: number | null;
  // Stock mínimo en la unidad base.
  alertQuantity?: number | null;
  brandId: number | null;
  categoryId: number | null;
  subCategoryId: number | null;
  tax: number | null;
  taxType: string;
  sku: string;
  image: string | null;
  imageFileId?: string | null;
  // URL firmada (vence en 1 hora).
  imageUrl?: string | null;
  productDescription: string | null;
  isInactive: boolean;
  notForSelling: boolean;
  preparationTimeInMinutes: number | null;
  variations: ProductVariationDto[];
}>;

export type ProductFiltersDto = Readonly<{
  page: number;
  perPage: number;
  name?: string;
  categoryId?: number;
}>;
