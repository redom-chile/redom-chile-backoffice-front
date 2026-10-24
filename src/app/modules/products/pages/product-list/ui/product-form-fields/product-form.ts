import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  CHEF_NOTE_MAX,
  CreateProductDto,
  ProductDto,
  ProductStockMode,
  ProductTypeInput,
  ProductVariationDto,
  UpdateProductDto,
  UpdateProductVariationDto,
} from '../../data-access';

// Variación única para productos sin variaciones reales (convención del backend).
const DEFAULT_VARIATION_NAME = 'DUMMY';

export const PACK_PRODUCT_TYPE = 'combo' as const;

export const MIN_VARIETIES = 2;
export const VARIETY_NAME_MAX = 191;

export type VarietyForm = FormGroup<{
  // null: variedad nueva (el backend la crea).
  id: FormControl<number | null>;
  name: FormControl<string>;
  price: FormControl<number | null>;
}>;

export function createVarietyForm(id: number | null = null, name = '', price: number | null = null): VarietyForm {
  return new FormGroup({
    id: new FormControl<number | null>(id),
    name: new FormControl(name, { nonNullable: true, validators: [Validators.required, Validators.maxLength(VARIETY_NAME_MAX)] }),
    // Mismas reglas que el precio único: un precio neto guardado puede tener decimales.
    price: new FormControl<number | null>(price, [Validators.required, Validators.min(0)]),
  });
}

/** Variaciones vigentes (las quitadas quedan inactivas: el backend no las elimina), en orden de creación. */
export function activeVariations(product: Pick<ProductDto, 'variations'>): ProductVariationDto[] {
  return product.variations.filter((variation) => variation.isActive !== false).sort((a, b) => a.id - b.id);
}

export function createProductForm(fb: FormBuilder, product?: ProductDto) {
  const active = product ? activeVariations(product) : [];
  const variation = active[0] ?? product?.variations[0];
  const hasVarieties = active.length >= MIN_VARIETIES;
  const form = fb.group({
    name: [product?.name ?? '', [Validators.required, Validators.minLength(2)]],
    sku: [product?.sku ?? '', [Validators.required, Validators.maxLength(30)]],
    categoryId: [product?.categoryId ?? (null as number | null)],
    subCategoryId: [product?.subCategoryId ?? (null as number | null)],
    price: [variation?.sellPriceIncTax ?? (null as number | null), [Validators.required, Validators.min(0)]],
    productDescription: [product?.productDescription ?? ''],
    // Nota del chef (plan con menu_design): se destaca en la carta.
    chefNote: [product?.chefNote ?? '', [Validators.maxLength(CHEF_NOTE_MAX)]],
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
    // Variedades ("Frutilla", "Frambuesa"): cada una con su precio; reemplazan al precio único.
    hasVarieties: [hasVarieties],
    // Variación del precio único: al pasar a variedades se convierte en la primera (conserva ventas y stock).
    singleVariationId: [hasVarieties ? null : (variation?.id ?? (null as number | null))],
    varieties: new FormArray<VarietyForm>(
      hasVarieties ? active.map((v) => createVarietyForm(v.id, v.name, v.sellPriceIncTax)) : [],
    ),
  });
  setVarietiesMode(form, hasVarieties);
  return form;
}

/** Con variedades se ignora el precio único (y al revés): el control deshabilitado no valida. */
export function setVarietiesMode(form: { controls: { price: AbstractControl; varieties: AbstractControl } }, enabled: boolean) {
  const { price, varieties } = form.controls;
  if (enabled) {
    price.disable({ emitEvent: false });
    varieties.enable({ emitEvent: false });
  } else {
    price.enable({ emitEvent: false });
    varieties.disable({ emitEvent: false });
  }
}

export const normalizeVarietyName = (name: string) => name.trim().toLocaleLowerCase('es');

const comparableName = (name: string) =>
  normalizeVarietyName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** El backend trata la variedad con el nombre del producto como DUMMY y la oculta en la carta. */
export function isVarietyNamedAsProduct(form: ProductForm, varietyName: string): boolean {
  const name = comparableName(varietyName);
  return !!name && name === comparableName(form.controls.name.value ?? '');
}

/** Nombres repetidos entre las variedades (sin distinguir mayúsculas ni espacios). */
export function duplicatedVarietyNames(form: ProductForm): Set<string> {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const variety of form.controls.varieties.controls) {
    const name = normalizeVarietyName(variety.controls.name.value);
    if (!name) continue;
    if (seen.has(name)) duplicated.add(name);
    seen.add(name);
  }
  return duplicated;
}

/** Reglas de las variedades que no son de un solo campo; null si están bien. */
export function varietiesError(form: ProductForm): string | null {
  if (!form.controls.hasVarieties.value) return null;
  const varieties = form.controls.varieties.controls;
  if (varieties.length < MIN_VARIETIES) return `Agrega al menos ${MIN_VARIETIES} variedades o vuelve al precio único`;
  // required acepta solo espacios: se enviaría una variedad sin nombre.
  if (varieties.some((variety) => !variety.controls.name.value.trim())) return 'Ingresa el nombre de cada variedad';
  if (varieties.some((variety) => normalizeVarietyName(variety.controls.name.value) === DEFAULT_VARIATION_NAME.toLowerCase()))
    return 'Usa otro nombre para la variedad';
  if (varieties.some((variety) => isVarietyNamedAsProduct(form, variety.controls.name.value)))
    return 'Usa un nombre distinto al del producto (por ejemplo, el tamaño o el sabor)';
  if (duplicatedVarietyNames(form).size) return 'Hay variedades con el mismo nombre';
  return null;
}

/**
 * Contexto al guardar: sin inventario activo no se envía ni cambia el control de stock;
 * sin la función menu_design no se envía la nota del chef.
 */
export type ProductStockContext = Readonly<{ inventoryEnabled: boolean; chefNoteEnabled?: boolean }>;

const chefNoteOf = (form: ProductForm): string | null => form.getRawValue().chefNote?.trim() || null;

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

/** Solo si cambió (null = quitarla). */
function toUpdateChefNote(form: ProductForm, original: ProductDto, { chefNoteEnabled }: ProductStockContext) {
  if (!chefNoteEnabled) return {};
  const note = chefNoteOf(form);
  return note !== (original.chefNote?.trim() || null) ? { chefNote: note } : {};
}

/** Al crear va en el POST solo si tiene texto (con texto el backend exige menu_design). */
function toCreateChefNote(form: ProductForm, { chefNoteEnabled }: ProductStockContext) {
  const note = chefNoteEnabled ? chefNoteOf(form) : null;
  return note ? { chefNote: note } : {};
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

function varietyRows(form: ProductForm) {
  return form.controls.varieties.getRawValue().map((variety) => ({
    id: variety.id,
    name: variety.name.trim(),
    sellPriceIncTax: Number(variety.price ?? 0),
  }));
}

export function toCreateProductDto(form: ProductForm, context: ProductStockContext): CreateProductDto {
  const { price, ...product } = toBasePayload(form);
  return {
    ...product,
    ...(form.getRawValue().isPack ? { type: PACK_PRODUCT_TYPE } : {}),
    ...toCreateStockFields(form, context),
    ...toCreateChefNote(form, context),
    variations: form.getRawValue().hasVarieties
      ? varietyRows(form).map(({ name, sellPriceIncTax }) => ({ name, sellPriceIncTax }))
      : [{ name: DEFAULT_VARIATION_NAME, sellPriceIncTax: price }],
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
  return {
    ...product,
    ...toUpdateTypeField(form, original),
    ...toUpdateStockFields(form, original, context),
    ...toUpdateChefNote(form, original, context),
    variations: toUpdateVariations(form, original, price),
  };
}

/**
 * El backend actualiza las que llevan id y crea las demás (en el orden enviado), pero no elimina:
 * una variedad quitada se desactiva y queda sin precio, así tampoco se puede vender ni aparece en la carta (#59).
 */
function toUpdateVariations(form: ProductForm, original: ProductDto, price: number): UpdateProductVariationDto[] {
  const active = activeVariations(original);
  const hide = (variation: ProductVariationDto): UpdateProductVariationDto => ({ id: variation.id, isActive: false, sellPriceIncTax: null });

  if (form.getRawValue().hasVarieties) {
    const rows = varietyRows(form);
    const kept = new Set(rows.map((row) => row.id).filter((id): id is number => id !== null));
    const existing = rows
      .filter((row) => row.id !== null)
      .sort((a, b) => a.id! - b.id!)
      .map(({ id, name, sellPriceIncTax }) => ({ id: id!, name, sellPriceIncTax, isActive: true }));
    const added = rows.filter((row) => row.id === null).map(({ name, sellPriceIncTax }) => ({ name, sellPriceIncTax }));
    return [...existing, ...active.filter((variation) => !kept.has(variation.id)).map(hide), ...added];
  }

  // Precio único: se conserva la primera variación (mismo id para el historial) y se ocultan las demás.
  const main = active[0] ?? original.variations[0];
  if (!main) return [{ name: DEFAULT_VARIATION_NAME, sellPriceIncTax: price }];
  const wasVarieties = active.length >= MIN_VARIETIES;
  return [
    {
      id: main.id,
      sellPriceIncTax: price,
      ...(main.isActive === false ? { isActive: true } : {}),
      ...(wasVarieties ? { name: DEFAULT_VARIATION_NAME } : {}),
    },
    ...active.filter((variation) => variation.id !== main.id).map(hide),
  ];
}
