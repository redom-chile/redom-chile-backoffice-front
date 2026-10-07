import { ProductStockMode } from './product.dto';

export type UpdateProductVariationDto = Readonly<{
  // Sin id, el backend crea la variación; con id, la actualiza.
  id?: number;
  name?: string;
  sellPriceIncTax?: number;
  isActive?: boolean;
}>;

// El id va solo en la URL (PUT /products/:id).
export type UpdateProductDto = Readonly<{
  name?: string;
  sku?: string;
  type?: 'ingredient';
  stockMode?: ProductStockMode;
  // null = quitar la unidad.
  unitId?: number | null;
  alertQuantity?: number;
  categoryId?: number;
  subCategoryId?: number;
  taxType?: 'inclusive' | 'exclusive';
  // undefined = no tocar, null = quitar.
  imageFileId?: string | null;
  productDescription?: string;
  isInactive?: boolean;
  preparationTimeInMinutes?: number;
  variations?: UpdateProductVariationDto[];
}>;
