/** Ingrediente = producto con type "ingredient" (GET /products?type=ingredient). Solo los campos que usa la pantalla. */
export type IngredientDto = Readonly<{
  id: number;
  name: string;
  sku: string;
  type: string | null;
  unitId: number | null;
  // Stock mínimo en la unidad base.
  alertQuantity: number | null;
  categoryId: number | null;
  variations: ReadonlyArray<Readonly<{ id: number; name: string }>>;
}>;

export type IngredientFiltersDto = Readonly<{
  page: number;
  perPage: number;
  name?: string;
}>;

/** POST /products: el backend fuerza stockMode "direct" y notForSelling true. */
export type CreateIngredientDto = Readonly<{
  name: string;
  sku: string;
  type: 'ingredient';
  unitId: number;
  alertQuantity?: number;
  categoryId?: number;
  variations: ReadonlyArray<Readonly<{ name: string }>>;
}>;

/** PUT /products/:id (null = quitar). */
export type UpdateIngredientDto = Readonly<{
  name?: string;
  sku?: string;
  unitId?: number;
  alertQuantity?: number;
  categoryId?: number | null;
}>;
