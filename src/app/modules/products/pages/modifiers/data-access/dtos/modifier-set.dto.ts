/** Opción de un set ("Extra queso"): una variación del producto de tipo modifier. Precio IVA incluido. */
export type ModifierOptionDto = Readonly<{
  id: number;
  name: string;
  price: number;
}>;

export type LinkedProductDto = Readonly<{
  id: number;
  name: string;
}>;

/** GET /modifier-sets: las opciones vienen ordenadas por nombre. */
export type ModifierSetDto = Readonly<{
  id: number;
  name: string;
  variations: ModifierOptionDto[];
  modifierProducts: LinkedProductDto[];
}>;

/** Arreglos paralelos: modifierName[i] cuesta modifierPrice[i]. */
export type CreateModifierSetDto = Readonly<{
  name: string;
  modifierName: string[];
  modifierPrice: number[];
}>;

/**
 * modifierNameEdit/modifierPriceEdit son posicionales contra las opciones existentes ordenadas por id ASC
 * (BACKEND-REQUESTS #34). modifierName/modifierPrice agregan opciones nuevas.
 */
export type UpdateModifierSetDto = Readonly<{
  id: number;
  name: string;
  modifierNameEdit?: string[];
  modifierPriceEdit?: number[];
  modifierName?: string[];
  modifierPrice?: number[];
}>;

export type ProductModifiersDto = Readonly<{
  modifierSet: Readonly<{ id: number; name: string }>;
  products: LinkedProductDto[];
}>;

/** Reemplaza los productos vinculados ([] los quita todos). */
export type UpdateProductModifiersDto = Readonly<{
  id: number;
  products: number[];
}>;
