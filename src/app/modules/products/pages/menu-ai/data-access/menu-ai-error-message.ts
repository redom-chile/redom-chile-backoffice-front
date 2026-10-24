import { HttpErrorResponse } from '@angular/common/http';
import { readApiError } from 'src/app/core/utils/api-error';
import { AiQuotaDto, AiSettingsField } from './dtos';

const SETTING_FIELDS: readonly AiSettingsField[] = ['isEnabled', 'tone', 'length', 'monthlyLimit', 'insightsEnabled', 'insightsFrequency'];

const asField = (value: unknown): AiSettingsField | null =>
  typeof value === 'string' && (SETTING_FIELDS as readonly string[]).includes(value) ? (value as AiSettingsField) : null;

/** La ruta no existe en el servidor: 405, o 404 con el mensaje de Nest "Cannot POST …". */
export function isRouteMissing(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  if (error.status === 405) return true;
  return error.status === 404 && /^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(readApiError(error).message);
}

/** 409 AI_CONTENT_DISABLED: el ajuste que está apagado (isEnabled o insightsEnabled). */
export function disabledSettingOf(error: unknown): AiSettingsField | null {
  const api = readApiError(error);
  if (api.code !== 'AI_CONTENT_DISABLED') return null;
  return asField(api.details['setting']) ?? 'isEnabled';
}

/** 400 AI_SETTINGS_INVALID: el campo rechazado. */
export function invalidSettingOf(error: unknown): AiSettingsField | null {
  const api = readApiError(error);
  return api.code === 'AI_SETTINGS_INVALID' ? asField(api.details['field']) : null;
}

type QuotaError = AiQuotaDto & Readonly<{ period: 'day' | 'month' }>;

/** Cuota que trae un 429 AI_CONTENT_QUOTA_EXCEEDED (period 'day': etiquetas del día). */
export function quotaFromError(error: unknown): QuotaError | null {
  const api = readApiError(error);
  if (api.code !== 'AI_CONTENT_QUOTA_EXCEEDED') return null;
  const { used, limit, period } = api.details as { used?: unknown; limit?: unknown; period?: unknown };
  if (typeof used !== 'number') return null;
  return { used, limit: typeof limit === 'number' ? limit : null, period: period === 'day' ? 'day' : 'month' };
}

/** null en errores de plan: los muestra el modal global. */
export function getMenuAiErrorMessage(error: unknown, fallback: string): string | null {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  const body = error.error as { code?: string; message?: unknown } | null;
  switch (body?.code) {
    case 'PLAN_FEATURE_NOT_INCLUDED':
      return null;
    case 'AI_CONTENT_DISABLED':
      return disabledSettingOf(error) === 'insightsEnabled'
        ? 'Activa las sugerencias de precio y promociones en la configuración.'
        : 'Activa la IA en la configuración para pedir sugerencias.';
    case 'AI_CONTENT_QUOTA_EXCEEDED': {
      const quota = quotaFromError(error);
      if (quota?.period === 'day') return `Llegaste al tope diario de etiquetas sugeridas${quota.limit !== null ? ` (${quota.limit})` : ''}. Vuelve a intentarlo mañana.`;
      return quota?.limit !== null && quota?.limit !== undefined
        ? `Usaste las ${quota.limit} descripciones con IA de este mes.`
        : 'Usaste las descripciones con IA de este mes.';
    }
    case 'AI_CONTENT_UNAVAILABLE':
      return 'La IA no está disponible ahora. Inténtalo más tarde.';
    case 'AI_INSIGHTS_RATE_LIMITED':
      return 'Ya actualizaste las sugerencias hoy. Vuelve a intentarlo mañana.';
    case 'AI_SETTINGS_INVALID':
      return SETTING_ERRORS[invalidSettingOf(error) ?? 'monthlyLimit'];
  }
  if (error.status === 0) return 'No hay conexión. Revisa tu internet.';
  const message = body?.message;
  return typeof message === 'string' && message && !/^[A-Z][a-z]+ [a-z]/.test(message) ? message : fallback;
}

export const SETTING_ERRORS: Record<AiSettingsField, string> = {
  isEnabled: 'Revisa si la IA queda activada.',
  tone: 'Elige un tono de la lista.',
  length: 'Elige un largo de la lista.',
  monthlyLimit: 'Usa un número entero desde 0 que no supere el límite de tu plan.',
  insightsEnabled: 'Revisa si las sugerencias quedan activadas.',
  insightsFrequency: 'Elige una frecuencia de la lista.',
};
