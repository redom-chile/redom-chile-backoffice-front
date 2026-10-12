import { ProductRecipesDto } from '../../../data-access';

/** Estado de receta de un producto (se calcula con GET /inventory/recipes, uno por producto). */
export type RecipeStatus =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{ kind: 'done'; withRecipe: number; total: number }>;

export function toRecipeStatus(data: ProductRecipesDto): RecipeStatus {
  return {
    kind: 'done',
    withRecipe: data.variations.filter((variation) => variation.items.length > 0).length,
    total: data.variations.length,
  };
}
