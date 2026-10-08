import { readApiError } from 'src/app/core/utils/api-error';

const BY_CODE: Record<string, string> = {
  HELP_ARTICLE_NOT_FOUND: 'No encontramos ese artículo o ya no está publicado.',
  HELP_CATEGORY_NOT_FOUND: 'La categoría no existe.',
  HELP_SLUG_TAKEN: 'Ya existe otro con ese identificador (slug). Usa uno distinto.',
  HELP_CATEGORY_NOT_EMPTY: 'La categoría tiene artículos: muévelos o desactívala en vez de borrarla.',
  HELP_AI_UNAVAILABLE: 'El asistente no está disponible en este momento.',
  HELP_RATE_LIMITED: 'Demasiadas preguntas seguidas. Espera un minuto y vuelve a intentarlo.',
};

/** Errores del centro de ayuda y del asistente. HELP_QUOTA_EXCEEDED se arma aparte (helpQuotaMessage). */
export function getHelpErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const api = readApiError(error);
  if (api.status === 0) return 'No hay conexión con el servidor.';
  if (api.status === 403) return 'No tienes acceso a esta sección.';
  if (api.code === 'HELP_QUOTA_EXCEEDED') return helpQuotaMessage(error);
  if (api.code && BY_CODE[api.code]) return BY_CODE[api.code];
  return fallback;
}

/** "Usaste las N preguntas de este mes; se renuevan el <fecha>". */
export function helpQuotaMessage(error: unknown): string {
  const { details } = readApiError(error);
  const limit = Number(details['limit']);
  const resetsAt = typeof details['resetsAt'] === 'string' ? new Date(details['resetsAt']) : null;
  const questions = Number.isFinite(limit) && limit > 0 ? `las ${limit} preguntas` : 'todas las preguntas';
  const date =
    resetsAt && !Number.isNaN(resetsAt.getTime())
      ? resetsAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })
      : null;
  return `Usaste ${questions} al asistente de este mes${date ? `; se renuevan el ${date}` : ''}. Mientras tanto, puedes buscar en los artículos.`;
}
