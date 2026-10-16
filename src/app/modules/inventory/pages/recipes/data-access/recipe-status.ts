import { ProductRecipesDto } from '../../../data-access';

/** Estado de receta de un producto (se calcula con GET /inventory/recipes, uno por producto). */
export type RecipeStatus =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{ kind: 'done'; withRecipe: number; total: number }>;

/** removedIds: variedades quitadas (no cuentan, salvo que aún tengan receta). */
export function toRecipeStatus(data: ProductRecipesDto, removedIds: ReadonlySet<number> = new Set()): RecipeStatus {
  const variations = data.variations.filter((variation) => !removedIds.has(variation.variationId) || variation.items.length > 0);
  return {
    kind: 'done',
    withRecipe: variations.filter((variation) => variation.items.length > 0).length,
    total: variations.length,
  };
}
