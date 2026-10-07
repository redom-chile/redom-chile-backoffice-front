import { readApiError } from 'src/app/core/utils/api-error';
import { getInventoryErrorMessage } from '../../../data-access';

/** Mensajes propios de POST /inventory/productions (sin códigos de negocio: se reconoce el texto en inglés). */
const TRANSLATIONS: ReadonlyArray<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /Only preparations \(ingredients with a production recipe\) can be produced/i,
    () => 'Solo se pueden producir preparaciones (ingredientes con receta de producción).',
  ],
  [
    /(.+?) has no production recipe/i,
    (m) => `${m[1]} no tiene receta de producción con rinde. Ármala en Recetas → Preparaciones.`,
  ],
  [/Preparation not found/i, () => 'La preparación ya no existe. Recarga la página.'],
  [/Location not found/i, () => 'El local no existe o fue eliminado.'],
  [
    /Not enough stock for: (.+?)(?: \(negative stock is not allowed\))?\.?$/i,
    (m) => `No hay stock suficiente en el local de: ${m[1]}. Registra una compra o produce menos.`,
  ],
];

/** Error de la producción en español; lo que no es propio lo traduce getInventoryErrorMessage. */
export function getProductionErrorMessage(error: unknown): string {
  const apiError = readApiError(error);
  if (apiError.status !== 0 && apiError.status !== 403 && apiError.message) {
    for (const [pattern, translate] of TRANSLATIONS) {
      const match = apiError.message.match(pattern);
      if (match) return translate(match);
    }
  }
  return getInventoryErrorMessage(error, 'No se pudo registrar la producción. Intenta nuevamente.');
}
