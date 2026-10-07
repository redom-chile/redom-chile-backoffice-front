import { RecipeVariationDto } from '../../../data-access';

/** La variación tiene receta de producción con ingredientes y rinde: se puede producir. */
export function canProduce(variation: RecipeVariationDto | null | undefined): boolean {
  return !!variation && variation.items.length > 0 && Number(variation.recipeYield ?? 0) > 0;
}

export type EstimateLine = Readonly<{
  variationId: number;
  name: string;
  unitName: string | null;
  // Positiva, en la unidad base del ingrediente.
  quantity: number;
  // Costo promedio por unidad base (null si se desconoce).
  unitCost: number | null;
  cost: number;
}>;

export type ProductionEstimate = Readonly<{
  producedBase: number;
  batches: number;
  lines: EstimateLine[];
  totalCost: number;
  // Costo por unidad de la preparación.
  unitCost: number;
  // Algún ingrediente sin costo conocido: el total queda subestimado.
  missingCost: boolean;
}>;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Mismo cálculo que el backend: tandas = producido / rinde y cada ingrediente
 * consume cantidad × (1 + merma/100) × tandas (las cantidades ≤ 0 no se consumen).
 */
export function estimateProduction(variation: RecipeVariationDto, producedBase: number): ProductionEstimate | null {
  const recipeYield = Number(variation.recipeYield ?? 0);
  if (!(producedBase > 0) || !(recipeYield > 0)) return null;
  const batches = producedBase / recipeYield;
  const lines = variation.items
    .map((item): EstimateLine => {
      const quantity = round4(Number(item.quantity) * (1 + Number(item.wastePercent ?? 0) / 100) * batches);
      const unitCost = item.unitCost === undefined ? null : Number(item.unitCost);
      return {
        variationId: item.ingredientVariationId,
        name: item.ingredientName,
        unitName: item.unitName,
        quantity,
        unitCost,
        cost: quantity * (unitCost ?? 0),
      };
    })
    .filter((line) => line.quantity > 0);
  const totalCost = lines.reduce((sum, line) => sum + line.cost, 0);
  return {
    producedBase,
    batches,
    lines,
    totalCost,
    unitCost: totalCost / producedBase,
    missingCost: lines.some((line) => !line.unitCost),
  };
}

/** Nombre del producto para buscarlo en el stock ("Producto - Variación" → "Producto"). */
export function stockSearchTerm(ingredientName: string): string {
  const index = ingredientName.lastIndexOf(' - ');
  return index > 0 ? ingredientName.slice(0, index) : ingredientName;
}
