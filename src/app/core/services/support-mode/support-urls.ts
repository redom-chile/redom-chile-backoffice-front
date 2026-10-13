/**
 * Pantallas que el SUPERADMIN puede abrir en modo soporte: solo la carta (alcance `catalog` del backend, #50).
 * Lo demás lo rechaza el backend con 403 SUPPORT_ACCESS_OUT_OF_SCOPE; aquí además se ocultan y se bloquean.
 */
const SUPPORT_PREFIXES = [
  '/products', // productos, categorías, marcas y modificadores
  '/inventory/ingredients',
  '/inventory/units',
  '/inventory/recipes',
  '/inventory/food-cost',
  '/settings/stations', // solo asignar productos a estaciones
  '/tables', // ver, regenerar QR y crear en bloque
  '/sectors', // ver y crear (no editar ni borrar)
];

export function isSupportUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/)[0];
  return SUPPORT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Primera pantalla al entrar en modo soporte. */
export const SUPPORT_HOME = '/products';
