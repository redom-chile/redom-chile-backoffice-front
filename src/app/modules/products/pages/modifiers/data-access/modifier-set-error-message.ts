import { ApiErrorCode, readApiError } from 'src/app/core/utils/api-error';

/** El backend responde estos errores sin código de negocio: se reconoce el mensaje en inglés. */
const TRANSLATIONS: ReadonlyArray<[RegExp, string]> = [
  [/Modifier set not found/i, 'El set de modificadores no existe o fue eliminado.'],
  [/One or more products not found/i, 'Uno o más productos ya no existen. Actualiza la lista y vuelve a intentarlo.'],
  [/Restaurant id not found/i, 'No se encontró el negocio de tu usuario.'],
];

/** Mensaje en español para un error HTTP de sets de modificadores. */
export function getModifierSetErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error inesperado. Intenta nuevamente.',
): string {
  const apiError = readApiError(error);
  if (apiError.status === 0) return 'No hay conexión con el servidor.';
  if (apiError.status === 403) return 'No tienes permiso para esta acción.';
  for (const [pattern, message] of TRANSLATIONS) {
    if (pattern.test(apiError.message)) return message;
  }
  if (apiError.code === ApiErrorCode.VALIDATION_ERROR || apiError.status === 400) {
    return 'Revisa los datos: cada opción necesita nombre y un precio válido.';
  }
  if (apiError.status === 404) return 'El set de modificadores no existe o fue eliminado.';
  return fallback;
}
