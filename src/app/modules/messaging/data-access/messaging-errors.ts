import { isPlanError } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { formatNumber, RANGES, SCHEDULE_MAX_DAYS } from './messaging-format';

export type MessagingError = Readonly<{
  /** null: error de plan (ya lo muestra el modal global). */
  message: string | null;
  /** Campo del formulario a marcar (details.field). */
  field: string | null;
  /** Variable desconocida de MESSAGING_TEMPLATE_INVALID (details.variable). */
  variable?: string | null;
}>;

const FIELD_MESSAGES: Record<string, string> = {
  name: 'Escribe un nombre (hasta 80 caracteres).',
  subject: 'Revisa el asunto (hasta 120 caracteres).',
  preheader: 'Revisa el texto de vista previa (hasta 150 caracteres).',
  body: 'Revisa el mensaje.',
  ctaLabel: 'Revisa el texto del botón (hasta 40 caracteres).',
  ctaUrl: 'El enlace del botón debe empezar con https://.',
  imageFileId: 'La imagen no se pudo usar. Elige otra.',
  audience: 'Revisa la audiencia.',
  'audience.segments': 'Revisa los segmentos elegidos.',
  'audience.locationId': 'El local elegido ya no existe.',
  scheduledAt: `Elige una fecha desde ahora y hasta ${SCHEDULE_MAX_DAYS} días más.`,
  email: 'Las pruebas solo pueden ir al correo de un usuario de tu negocio.',
  delayHours: `Usa entre ${RANGES.delayHours[0]} y ${RANGES.delayHours[1]} horas.`,
  daysBefore: `Usa entre ${RANGES.daysBefore[0]} y ${RANGES.daysBefore[1]} días.`,
  cooldownDays: `Usa entre ${RANGES.cooldownDays[0]} y ${RANGES.cooldownDays[1]} días.`,
};

/** Traduce los errores de mensajería por código (y marca el campo de details.field). */
export function messagingError(error: unknown, fallback = 'No se pudo completar la operación.'): MessagingError {
  if (isPlanError(error)) return { message: null, field: null };
  const api = readApiError(error);
  const field = typeof api.details['field'] === 'string' ? (api.details['field'] as string) : null;
  if (api.status === 0) return { message: 'No hay conexión con el servidor.', field: null };
  switch (api.code) {
    case 'MESSAGING_TEMPLATE_INVALID': {
      const variable = api.details['variable'];
      if (typeof variable === 'string') return { message: `La variable {{${variable}}} no existe.`, field, variable };
      return { message: (field && FIELD_MESSAGES[field]) || 'Revisa los datos del formulario: hay un valor que no es válido.', field };
    }
    case 'MESSAGING_QUOTA_EXCEEDED': {
      const used = Number(api.details['used'] ?? 0);
      const limit = Number(api.details['limit'] ?? 0);
      const needed = Number(api.details['needed'] ?? 0);
      return { message: `Te quedan ${formatNumber(Math.max(limit - used, 0))} correos este mes y necesitas ${formatNumber(needed)}.`, field: null };
    }
    case 'MESSAGING_AUDIENCE_EMPTY':
      return { message: 'Ningún cliente cumple con la audiencia elegida.', field: null };
    case 'MESSAGING_CAMPAIGN_LOCKED':
      return { message: 'Esta campaña ya se envió o se canceló; no se puede cambiar.', field: null };
  }
  if (field && FIELD_MESSAGES[field]) return { message: FIELD_MESSAGES[field], field };
  if (api.status === 404) return { message: 'Lo que buscas ya no existe. Recarga la página.', field: null };
  if (api.status === 403) return { message: 'No tienes permiso para hacer esto.', field: null };
  if (api.status === 400) return { message: 'Revisa los datos del formulario: hay un valor que no es válido.', field };
  return { message: fallback, field: null };
}

export const isCampaignLocked = (error: unknown) => readApiError(error).code === 'MESSAGING_CAMPAIGN_LOCKED';
export const isFeatureNotIncluded = (error: unknown) => readApiError(error).code === 'PLAN_FEATURE_NOT_INCLUDED';
