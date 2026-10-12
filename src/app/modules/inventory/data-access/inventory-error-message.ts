import { readApiError } from 'src/app/core/utils/api-error';

/**
 * El backend de inventario aún no envía códigos de error (BACKEND-REQUESTS #31): se reconoce el mensaje
 * en inglés y se traduce. Si no se reconoce, se muestra el mensaje tal cual.
 */
const TRANSLATIONS: ReadonlyArray<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/Inventory is not enabled/i, () => 'El inventario no está activado para este negocio.'],
  [/Ingredients and recipes are not enabled/i, () => 'Activa "Trabajar con ingredientes y recetas" en la configuración de inventario.'],
  [/deductStockOnSale and ingredientsEnabled require inventoryEnabled/i, () => 'Primero activa el inventario.'],
  [/An ingredient cannot have a recipe/i, () => 'Un ingrediente no puede tener receta.'],
  [/An ingredient needs a unit/i, () => 'El ingrediente necesita una unidad (ej. g, ml, unidad).'],
  [/Not enough stock for: (.+)/i, (m) => `No hay stock suficiente de: ${m[1]}. Activa "Permitir stock negativo" o revisa las cantidades.`],
  [/Variations not found: (.+)/i, () => 'Uno de los productos ya no existe. Quítalo y vuelve a agregarlo.'],
  [/Only products with stockMode "direct".*?: (.+)/i, (m) => `Estos productos no tienen stock propio: ${m[1]}. Cambia su "Control de stock" a "Stock propio".`],
  [/Unit (\d+) not found/i, () => 'La unidad elegida ya no existe.'],
  [/Unit "(.+?)" does not allow decimals \(product (.+)\)/i, (m) => `La unidad "${m[1]}" no permite decimales (${m[2]}).`],
  [/Unit "(.+?)" is not a sub unit of the unit of product (.+)/i, (m) => `"${m[1]}" no es una subunidad de la unidad de ${m[2]}.`],
  // Transferencias
  [/The origin and the destination must be different locations/i, () => 'El origen y el destino deben ser locales distintos.'],
  [/An item is repeated in the transfer/i, () => 'Hay un ítem repetido en la transferencia: suma sus cantidades en una sola línea.'],
  [/Location not found/i, () => 'Uno de los locales ya no existe. Recarga la página.'],
  [/Adjustment quantities cannot be 0/i, () => 'Las cantidades no pueden ser 0.'],
  [/For "(.+?)" enter the quantity as a positive number/i, () => 'Para este motivo ingresa la cantidad en positivo.'],
  [/A cost can only be set for stock that is added/i, () => 'El costo solo se puede indicar en líneas que suman stock.'],
  // Lotes
  [/A lot or expiry date can only be set for stock that is added/i, () => 'El lote y el vencimiento solo se indican en líneas que suman stock (las salidas usan primero lo que vence antes).'],
  // Recetas
  [/Only dishes \(stockMode "recipe"\) and modifier options have a recipe; (.+?) has stockMode/i, (m) => `Solo los platos "Por receta" y las opciones de modificador tienen receta; ${m[1]} no es "Por receta".`],
  [/An ingredient is repeated in the recipe/i, () => 'Hay un ingrediente repetido en la receta: suma sus cantidades en una sola fila.'],
  [/A product cannot consume itself/i, () => 'Un producto no puede ser ingrediente de sí mismo.'],
  [/Negative quantities are only allowed in modifier options/i, () => 'Solo las opciones de modificador pueden quitar ingredientes (cantidad negativa).'],
  [/Variation not found/i, () => 'La variación ya no existe. Recarga la página.'],
  [/Product not found/i, () => 'El producto no existe o fue eliminado.'],
  [/Business not found/i, () => 'No se encontró el negocio.'],
];

export function translateInventoryMessage(message: string): string {
  for (const [pattern, translate] of TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return translate(match);
  }
  return message;
}

/** Mensaje en español para un error HTTP de inventario, unidades o productos. */
export function getInventoryErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado. Intenta nuevamente.'): string {
  const apiError = readApiError(error);
  if (apiError.status === 0) return 'No hay conexión con el servidor.';
  if (apiError.status === 403) return 'No tienes permiso para esta acción.';
  return apiError.message ? translateInventoryMessage(apiError.message) : fallback;
}

/** 409 "Inventory is not enabled…": mostrar la pantalla "Activar inventario". */
export function isInventoryDisabledError(error: unknown): boolean {
  const apiError = readApiError(error);
  return apiError.status === 409 && /Inventory is not enabled/i.test(apiError.message);
}
