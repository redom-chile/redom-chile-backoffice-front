import { readApiError } from 'src/app/core/utils/api-error';
import { getInventoryErrorMessage } from '../../../data-access';

/** Mensajes propios de POST /inventory/counts (sin códigos de negocio: se reconoce el texto en inglés). */
const TRANSLATIONS: ReadonlyArray<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/An item is repeated in the count/i, () => 'Hay un ítem repetido en el conteo: suma sus cantidades en una sola línea.'],
  [/Variations not found/i, () => 'Uno de los ítems ya no existe. Recarga la planilla y vuelve a intentarlo.'],
  [
    /Only products with stockMode "direct".*?: (.+)/i,
    (m) => `Estos productos ya no tienen stock propio: ${m[1]}. Recarga la planilla y vuelve a intentarlo.`,
  ],
  [/Location not found/i, () => 'El local no existe o fue eliminado.'],
];

/** Error del conteo en español; lo que no es propio del conteo lo traduce getInventoryErrorMessage. */
export function getCountErrorMessage(error: unknown): string {
  const apiError = readApiError(error);
  if (apiError.status !== 0 && apiError.status !== 403 && apiError.message) {
    for (const [pattern, translate] of TRANSLATIONS) {
      const match = apiError.message.match(pattern);
      if (match) return translate(match);
    }
  }
  return getInventoryErrorMessage(error, 'No se pudo registrar el conteo. Intenta nuevamente.');
}
