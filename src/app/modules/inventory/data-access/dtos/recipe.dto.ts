// ---------- Recetas: GET /inventory/recipes?productId · PUT /inventory/recipes/:variationId ----------

/** Ingrediente de una receta. Cantidad por unidad vendida, en la unidad base del ingrediente. */
export type RecipeItemDto = Readonly<{
  id: number;
  ingredientProductId: number;
  ingredientVariationId: number;
  // "Producto" o "Producto - Variación".
  ingredientName: string;
  ingredientType: string | null;
  // Unidad base del ingrediente (la receta siempre vuelve en unidad base).
  unitId: number | null;
  unitName: string | null;
  // Negativa solo en opciones de modificador ("Sin cebolla" devuelve lo que el plato iba a consumir).
  quantity: number;
  wastePercent: number;
  // Costo promedio por unidad base (del local o promedio del negocio; 0 si no hay).
  unitCost?: number;
  cost?: number;
}>;

/** Receta de una variación del plato, o de una opción si el producto es un set de modificadores. */
export type RecipeVariationDto = Readonly<{
  variationId: number;
  // null cuando el producto no tiene variaciones.
  variationName: string | null;
  sellPriceIncTax: number | null;
  items: RecipeItemDto[];
  recipeCost?: number;
  recipeYield?: number | null;
  costPerUnit?: number | null;
  // Costo / precio neto sin IVA × 100; null si no tiene precio.
  foodCostPercent?: number | null;
}>;

export type ProductRecipesDto = Readonly<{
  productId: number;
  productName: string;
  // 'modifier' cuando es un set de modificadores.
  productType: string | null;
  stockMode: string;
  // stockMode 'recipe' o set de modificadores.
  canHaveRecipe: boolean;
  recipeKind?: 'sale' | 'production';
  // null = promedio del negocio.
  locationId?: number | null;
  variations: RecipeVariationDto[];
}>;

export type RecipeItemInputDto = Readonly<{
  // Variación del ingrediente (o de un producto con stock propio).
  variationId: number;
  // En la unidad indicada (o la base); máx. 4 decimales, distinta de 0.
  quantity: number;
  // Unidad base del ingrediente o una subunidad; el backend guarda en la base.
  unitId?: number | null;
  // 0..99,99, máx. 2 decimales.
  wastePercent?: number | null;
}>;

/** Reemplaza la receta completa; items [] la borra. Máx. 100 ítems. */
export type UpdateRecipeDto = Readonly<{ items: RecipeItemInputDto[] }>;

export type UpdateRecipeResponseDto = Readonly<{
  productId: number;
  variationId: number;
  items: RecipeItemDto[];
}>;
