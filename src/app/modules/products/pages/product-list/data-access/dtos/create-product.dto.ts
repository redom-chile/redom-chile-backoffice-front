import { ProductStockMode, ProductTypeInput } from './product.dto';

export type CreateProductVariationDto = Readonly<{
  name: string;
  sellPriceIncTax?: number;
  isActive?: boolean;
}>;

export type CreateProductDto = Readonly<{
  name: string;
  sku: string;
  // 'ingredient' = insumo con stock que no se vende (el backend fuerza stockMode 'direct').
  // 'combo' = pack: su contenido va por PUT /products/:id/pack. 'single' = producto normal.
  type?: ProductTypeInput;
  stockMode?: ProductStockMode;
  unitId?: number;
  alertQuantity?: number;
  categoryId?: number;
  subCategoryId?: number;
  taxType?: 'inclusive' | 'exclusive';
  imageFileId?: string;
  productDescription?: string;
  isInactive?: boolean;
  preparationTimeInMinutes?: number;
  variations?: CreateProductVariationDto[];
}>;
