import { FormBuilder, Validators } from '@angular/forms';
import { CreateProductDto, ProductDto, ProductStockMode, ProductTypeInput, UpdateProductDto } from '../../data-access';

// Variación única para productos sin variaciones reales (convención del backend).
const DEFAULT_VARIATION_NAME = 'DUMMY';

export const PACK_PRODUCT_TYPE = 'combo' as const;

export function createProductForm(fb: FormBuilder, product?: ProductDto) {
  const variation = product?.variations[0];
  return fb.group({
    name: [product?.name ?? '', [Validators.required, Validators.minLength(2)]],
    sku: [product?.sku ?? '', [Validators.required, Validators.maxLength(30)]],
    categoryId: [product?.categoryId ?? (null as number | null)],
    subCategoryId: [product?.subCategoryId ?? (null as number | null)],
    price: [variation?.sellPriceIncTax ?? (null as number | null), [Validators.required, Validators.min(0)]],
    productDescription: [product?.productDescription ?? ''],
    preparationTimeInMinutes: [
      product?.preparationTimeInMinutes ?? (null as number | null),
      [Validators.min(0), Validators.max(600)],
    ],
    available: [product ? !product.isInactive : true],
    // Control de stock: solo se muestra/envía con el inventario activo.
    stockMode: [product?.stockMode ?? ('none' as ProductStockMode)],
    // Solo para "Stock propio": unidad base opcional y stock mínimo (en esa unidad).
    unitId: [product?.unitId ?? (null as number | null)],
    alertQuantity: [product?.alertQuantity || (null as number | null), [Validators.min(0)]],
    // Tipo: producto normal o pack / combo (type 'combo'; su contenido se guarda aparte).
    isPack: [product?.type === PACK_PRODUCT_TYPE],
  });
}

/** Contexto del inventario al guardar: sin inventario activo no se envía ni cambia el control de stock. */
export type ProductStockContext = Readonly<{ inventoryEnabled: boolean }>;

export type ProductForm = ReturnType<typeof createProductForm>;

export function suggestSku(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word.slice(0, 4));
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return [...(words.length ? words : ['PROD']), suffix].join('-');
}

function toBasePayload(form: ProductForm) {
  const value = form.getRawValue();
  return {
    name: value.name!.trim(),
    sku: value.sku!.trim().toUpperCase(),
    categoryId: value.categoryId ?? undefined,
    subCategoryId: value.subCategoryId ?? undefined,
    taxType: 'inclusive' as const,
    productDescription: value.productDescription?.trim() || undefined,
    isInactive: !value.available,
    preparationTimeInMinutes: value.preparationTimeInMinutes ?? undefined,
    price: value.price ?? 0,
  };
}

export function toCreateProductDto(form: ProductForm, context: ProductStockContext): CreateProductDto {
  const { price, ...product } = toBasePayload(form);
  return {
    ...product,
    ...(form.getRawValue().isPack ? { type: PACK_PRODUCT_TYPE } : {}),
    ...toCreateStockFields(form, context),
    variations: [{ name: DEFAULT_VARIATION_NAME, sellPriceIncTax: price }],
  };
}

function toCreateStockFields(form: ProductForm, { inventoryEnabled }: ProductStockContext) {
  if (!inventoryEnabled) return {};
  const { stockMode, unitId, alertQuantity } = form.getRawValue();
  const mode = stockMode ?? 'none';
  if (mode !== 'direct') return { stockMode: mode };
  return {
    stockMode: mode,
    ...(unitId ? { unitId } : {}),
    ...(alertQuantity ? { alertQuantity } : {}),
  };
}

// Al editar solo se envía lo que cambió: así no se toca el stock de productos que no se modificaron.
function toUpdateStockFields(form: ProductForm, original: ProductDto, { inventoryEnabled }: ProductStockContext) {
  if (!inventoryEnabled) return {};
  const { stockMode, unitId, alertQuantity } = form.getRawValue();
  const mode = stockMode ?? 'none';
  const fields: { stockMode?: ProductStockMode; unitId?: number | null; alertQuantity?: number } = {};
  if (mode !== (original.stockMode ?? 'none')) fields.stockMode = mode;
  if (mode === 'direct') {
    if ((unitId ?? null) !== (original.unitId ?? null)) fields.unitId = unitId ?? null;
    if ((alertQuantity ?? 0) !== Number(original.alertQuantity ?? 0)) fields.alertQuantity = alertQuantity ?? 0;
  }
  return fields;
}

// El tipo solo se envía si cambia entre producto normal y pack (no se toca el de otros tipos).
function toUpdateTypeField(form: ProductForm, original: ProductDto): { type?: ProductTypeInput } {
  const wasPack = original.type === PACK_PRODUCT_TYPE;
  const isPack = !!form.getRawValue().isPack;
  if (isPack === wasPack) return {};
  return { type: isPack ? PACK_PRODUCT_TYPE : 'single' };
}

export function toUpdateProductDto(form: ProductForm, original: ProductDto, context: ProductStockContext): UpdateProductDto {
  const { price, ...product } = toBasePayload(form);
  const variation = original.variations[0];
  return {
    ...product,
    ...toUpdateTypeField(form, original),
    ...toUpdateStockFields(form, original, context),
    variations: [
      variation
        ? { id: variation.id, sellPriceIncTax: price }
        : { name: DEFAULT_VARIATION_NAME, sellPriceIncTax: price },
    ],
  };
}
