import { readApiError } from 'src/app/core/utils/api-error';
import { getInventoryErrorMessage } from '../../../data-access';

/** Mensajes propios de PUT /inventory/recipes (preparaciones); lo demás lo traduce getInventoryErrorMessage. */
const TRANSLATIONS: ReadonlyArray<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/A preparation recipe needs yieldQuantity/i, () => 'Indica cuánto rinde una tanda de la preparación.'],
  [/The recipe would contain itself through another preparation/i, () => 'La receta se contendría a sí misma a través de otra preparación. Quita esa preparación de la receta.'],
  [
    /Only dishes \(stockMode "recipe"\), modifier options and preparations \(ingredients\) have a recipe; (.+?) has stockMode/i,
    (m) => `Solo los platos "Por receta", las opciones de modificador y las preparaciones (ingredientes) tienen receta; ${m[1]} no es ninguno de ellos.`,
  ],
];

/** Error al guardar una receta, en español. */
export function getRecipeErrorMessage(error: unknown): string {
  const apiError = readApiError(error);
  if (apiError.status !== 0 && apiError.status !== 403 && apiError.message) {
    for (const [pattern, translate] of TRANSLATIONS) {
      const match = apiError.message.match(pattern);
      if (match) return translate(match);
    }
  }
  return getInventoryErrorMessage(error, 'No se pudo guardar la receta.');
}
