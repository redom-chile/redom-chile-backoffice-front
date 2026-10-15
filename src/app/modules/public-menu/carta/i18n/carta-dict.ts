import { MenuLanguage } from '../../data-access/dtos/menu-translations.dto';

/** Idiomas de la interfaz de la carta (los mismos que la carta puede traer traducida). */
export type CartaLang = MenuLanguage;

type Strings = Readonly<Record<string, string>>;

/** Español es la fuente: los demás idiomas deben tener exactamente sus claves. */
export type CartaDict<T extends Strings> = Readonly<
  { es: T } & Record<Exclude<CartaLang, 'es'>, { readonly [K in keyof NoInfer<T>]: string }>
>;

/**
 * Diccionario de un área de la carta. Textos con {param}; los plurales usan dos claves `x.one` / `x.other` (ctn).
 */
export const defineCartaDict = <T extends Strings>(dict: CartaDict<T>): CartaDict<T> => dict;
