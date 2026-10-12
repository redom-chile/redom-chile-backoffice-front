import { FormArray, FormControl, FormGroup, ValidationErrors } from '@angular/forms';
import { RecipeItemDto, RecipeItemInputDto, StockableItem, UnitDto, unitMultiplier } from '../../../data-access';

/** Máximo de ingredientes por receta (backend: 100). */
export const MAX_RECIPE_ITEMS = 100;

export type RecipeRowForm = FormGroup<{
  item: FormControl<StockableItem>;
  // Siempre positiva; el signo lo da "subtract".
  quantity: FormControl<number | null>;
  // null = unidad base (o ítem sin unidad).
  unitId: FormControl<number | null>;
  wastePercent: FormControl<number | null>;
  // "Quita ingrediente" (solo opciones de modificador): la cantidad viaja negativa.
  subtract: FormControl<boolean>;
}>;

export type RecipeRowsArray = FormArray<RecipeRowForm>;

function decimalsOf(value: number): number {
  const [, decimals = ''] = String(value).split('.');
  return decimals.length;
}

function validateRow(row: RecipeRowForm): ValidationErrors | null {
  const { quantity, wastePercent } = row.getRawValue();
  const errors: ValidationErrors = {};

  if (quantity === null || quantity === undefined || !Number.isFinite(Number(quantity))) errors['quantityRequired'] = true;
  else if (quantity <= 0) errors['quantityPositive'] = true;
  else if (decimalsOf(quantity) > 4) errors['quantityPrecision'] = true;

  if (wastePercent !== null && wastePercent !== undefined) {
    if (!Number.isFinite(Number(wastePercent)) || wastePercent < 0 || wastePercent > 99.99) errors['wasteRange'] = true;
    else if (decimalsOf(wastePercent) > 2) errors['wastePrecision'] = true;
  }

  return Object.keys(errors).length ? errors : null;
}

export function createRecipeRow(
  item: StockableItem,
  values: Partial<{ quantity: number | null; unitId: number | null; wastePercent: number | null; subtract: boolean }> = {},
): RecipeRowForm {
  return new FormGroup(
    {
      item: new FormControl(item, { nonNullable: true }),
      quantity: new FormControl<number | null>(values.quantity ?? null),
      unitId: new FormControl<number | null>(values.unitId ?? item.unitId),
      wastePercent: new FormControl<number | null>(values.wastePercent ?? 0),
      subtract: new FormControl(values.subtract ?? false, { nonNullable: true }),
    },
    { validators: (group) => validateRow(group as RecipeRowForm) },
  );
}

/** Ítem guardado (cantidad en unidad base) → fila del formulario. */
export function rowFromRecipeItem(item: RecipeItemDto): RecipeRowForm {
  const stockable: StockableItem = {
    productId: item.ingredientProductId,
    variationId: item.ingredientVariationId,
    label: item.ingredientName,
    sku: '',
    kind: item.ingredientType === 'ingredient' ? 'ingredient' : 'product',
    unitId: item.unitId,
    defaultPurchasePrice: null,
  };
  return createRecipeRow(stockable, {
    quantity: Math.abs(item.quantity),
    unitId: item.unitId,
    wastePercent: item.wastePercent ?? 0,
    subtract: item.quantity < 0,
  });
}

export function quantityError(row: RecipeRowForm): string | null {
  const errors = row.errors ?? {};
  if (errors['quantityRequired']) return 'Ingresa la cantidad.';
  if (errors['quantityPositive']) return 'La cantidad debe ser mayor a 0.';
  if (errors['quantityPrecision']) return 'Máximo 4 decimales.';
  return null;
}

export function wasteError(row: RecipeRowForm): string | null {
  const errors = row.errors ?? {};
  if (errors['wasteRange']) return 'Entre 0 y 99,99 %.';
  if (errors['wastePrecision']) return 'Máximo 2 decimales.';
  return null;
}

/** Cuerpo del PUT: unitId solo si es una subunidad; la merma solo si no es 0. */
export function toRecipeItems(rows: RecipeRowsArray): RecipeItemInputDto[] {
  return rows.controls.map((row) => {
    const { item, quantity, unitId, wastePercent, subtract } = row.getRawValue();
    const amount = Number(quantity);
    const waste = Number(wastePercent ?? 0);
    return {
      variationId: item.variationId,
      quantity: subtract ? -amount : amount,
      ...(unitId && unitId !== item.unitId ? { unitId } : {}),
      ...(waste ? { wastePercent: waste } : {}),
    };
  });
}

/** Cantidad con signo en la unidad base del ingrediente (null si la cantidad aún no es válida). */
export function baseQuantity(row: RecipeRowForm, unit: UnitDto | null): number | null {
  const { quantity, subtract } = row.getRawValue();
  if (quantity === null || !Number.isFinite(Number(quantity))) return null;
  const value = Math.round(Number(quantity) * unitMultiplier(unit) * 10000) / 10000;
  return subtract ? -value : value;
}

/** Firma comparable del formulario (para saber si hay cambios sin guardar). */
export function recipeSignature(rows: RecipeRowsArray): string {
  return JSON.stringify(
    rows.controls.map((row) => {
      const { item, quantity, unitId, wastePercent, subtract } = row.getRawValue();
      return [item.variationId, quantity, unitId, Number(wastePercent ?? 0), subtract];
    }),
  );
}

/** Firma de lo guardado (ítems y rinde) para no pisar el formulario si solo cambiaron los costos. */
export function savedItemsSignature(items: readonly RecipeItemDto[], recipeYield: number | null = null): string {
  return JSON.stringify([
    items.map((item) => [item.ingredientVariationId, item.quantity, item.unitId, item.wastePercent]),
    recipeYield === null ? null : Number(recipeYield),
  ]);
}

// ---------- Rinde de una preparación (cuánto produce una tanda) ----------

/** Rinde en la unidad de la preparación (null si aún no es un número). */
export function yieldInProductUnits(quantity: number | null, unit: UnitDto | null, productUnitId: number | null): number | null {
  if (quantity === null || quantity === undefined || !Number.isFinite(Number(quantity))) return null;
  const multiplier = unit && unit.id !== productUnitId ? unitMultiplier(unit) : 1;
  return Math.round(Number(quantity) * multiplier * 10000) / 10000;
}

/** Obligatorio solo si la receta tiene ingredientes; > 0 y máx. 4 decimales. */
export function yieldError(quantity: number | null, required: boolean): string | null {
  if (quantity === null || quantity === undefined || !Number.isFinite(Number(quantity))) {
    return required ? 'Indica cuánto rinde una tanda.' : null;
  }
  if (quantity <= 0) return 'El rinde debe ser mayor a 0.';
  if (decimalsOf(quantity) > 4) return 'Máximo 4 decimales.';
  return null;
}
