import { HttpErrorResponse } from '@angular/common/http';
import { readApiError } from 'src/app/core/utils/api-error';
import { MessageKind, MessageStatus, Segment, SegmentSettingsDto, SegmentSettingsField } from './dtos';

/** Orden en que se muestran las tarjetas del panel. */
export const SEGMENT_ORDER: readonly Segment[] = ['new', 'frequent', 'atRisk', 'lost', 'vip', 'occasional'];

export const SEGMENT_LABELS: Readonly<Record<Segment, { plural: string; singular: string; icon: string; chip: string }>> = {
  new: { plural: 'Nuevos', singular: 'Nuevo', icon: 'fiber_new', chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  frequent: { plural: 'Frecuentes', singular: 'Frecuente', icon: 'repeat', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  atRisk: { plural: 'En riesgo', singular: 'En riesgo', icon: 'warning', chip: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  lost: { plural: 'Perdidos', singular: 'Perdido', icon: 'person_off', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  vip: { plural: 'VIP', singular: 'VIP', icon: 'workspace_premium', chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  occasional: { plural: 'Ocasionales', singular: 'Ocasional', icon: 'schedule', chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
};

/** Explicación de cada segmento con los valores actuales (sin ajustes, los de Redom). */
export function segmentHint(segment: Segment, settings: SegmentSettingsDto | null): string {
  const s = settings ?? DEFAULT_SEGMENT_SETTINGS;
  switch (segment) {
    case 'vip':
      return `Está en el ${s.vipTopPercent}% de clientes que más gastó en el último año y no se ha perdido.`;
    case 'atRisk':
      return `Vino ${s.frequentVisits} veces o más, pero no vuelve hace más de ${s.atRiskDays} días (y menos de ${s.lostDays}).`;
    case 'frequent':
      return `Vino ${s.frequentVisits} veces o más en los últimos 90 días.`;
    case 'new':
      return `Su primera visita fue hace ${s.newDays} días o menos.`;
    case 'lost':
      return `No vuelve hace más de ${s.lostDays} días.`;
    case 'occasional':
      return 'Compró alguna vez, pero no calza en los otros segmentos.';
  }
}

export const SEGMENT_PRIORITY_TEXT = 'Cada cliente queda en el primer segmento que calza: VIP, En riesgo, Frecuente, Nuevo, Perdido y Ocasional.';

export const DEFAULT_SEGMENT_SETTINGS: SegmentSettingsDto = { newDays: 30, frequentVisits: 3, atRiskDays: 30, lostDays: 90, vipTopPercent: 10 };

export const SEGMENT_SETTINGS_FIELDS: ReadonlyArray<
  Readonly<{ key: SegmentSettingsField; label: string; min: number; max: number; suffix: string; hint: string }>
> = [
  { key: 'newDays', label: 'Cliente nuevo', min: 1, max: 365, suffix: 'días', hint: 'Días desde su primera visita en que se considera nuevo (1 a 365).' },
  { key: 'frequentVisits', label: 'Cliente frecuente', min: 2, max: 100, suffix: 'visitas', hint: 'Visitas en 90 días para ser frecuente (2 a 100). También define quién puede quedar en riesgo.' },
  { key: 'atRiskDays', label: 'En riesgo', min: 7, max: 365, suffix: 'días', hint: 'Días sin venir de un cliente frecuente para quedar en riesgo (7 a 365).' },
  { key: 'lostDays', label: 'Perdido', min: 14, max: 730, suffix: 'días', hint: 'Días sin venir para darlo por perdido (14 a 730). Debe ser mayor que los días de En riesgo.' },
  { key: 'vipTopPercent', label: 'VIP', min: 1, max: 50, suffix: '%', hint: 'Porcentaje de clientes que más gasta en el último año (1 a 50).' },
];

export function segmentFieldLabel(field: string): string {
  return SEGMENT_SETTINGS_FIELDS.find((item) => item.key === field)?.label ?? field;
}

export const CHANNEL_LABELS: Readonly<Record<string, string>> = { pos: 'POS', menu: 'Carta' };
export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

export const MESSAGE_KIND_LABELS: Readonly<Record<MessageKind, string>> = { automation: 'Automático', campaign: 'Campaña', test: 'Prueba' };

const MESSAGE_TYPE_LABELS: Readonly<Record<string, string>> = {
  postVisitSurvey: 'Encuesta después de la visita',
  loyaltyRewardAvailable: 'Tienes una recompensa',
  loyaltyPointsExpiring: 'Tus puntos vencen',
  winBack: 'Te extrañamos',
  campaign: 'Campaña',
};
export function messageTypeLabel(type: string): string {
  return MESSAGE_TYPE_LABELS[type] ?? type;
}

export const MESSAGE_STATUS_LABELS: Readonly<Record<MessageStatus, { label: string; chip: string }>> = {
  queued: { label: 'En cola', chip: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
  sent: { label: 'Enviado', chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  delivered: { label: 'Entregado', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  failed: { label: 'Falló', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  bounced: { label: 'Rebotó', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  complained: { label: 'Marcado como spam', chip: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  skipped: { label: 'No enviado', chip: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
};
export function messageStatusOf(status: string): { label: string; chip: string } {
  return MESSAGE_STATUS_LABELS[status as MessageStatus] ?? { label: status, chip: MESSAGE_STATUS_LABELS.queued.chip };
}

const MESSAGE_REASON_LABELS: Readonly<Record<string, string>> = {
  businessNotFound: 'El negocio no existe',
  planFeature: 'El plan no incluye la mensajería',
  cancelled: 'La campaña se canceló',
  disabled: 'La automatización está apagada',
  suppressed: 'Su correo tiene problemas',
  unsubscribed: 'Se dio de baja',
  noConsent: 'No acepta novedades',
  cooldown: 'Ya recibió este correo hace poco',
  quotaExceeded: 'Sin cupo de correos del mes',
  quota: 'Sin cupo de correos del mes',
  providerError: 'Error del proveedor de correo',
  hardBounce: 'El correo no existe',
  softBounce: 'El buzón no lo recibió por ahora',
  complaint: 'Lo marcó como spam',
};
export function messageReasonLabel(reason: string): string {
  return MESSAGE_REASON_LABELS[reason] ?? reason;
}

const relative = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });
const longDate = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });

/** "hace 3 días", "hace 2 meses"… */
export function relativeDate(date: string | null, now = Date.now()): string {
  if (!date) return '—';
  const days = Math.round((new Date(date).getTime() - now) / 86_400_000);
  if (Math.abs(days) < 1) {
    const hours = Math.round((new Date(date).getTime() - now) / 3_600_000);
    return Math.abs(hours) < 1 ? 'recién' : relative.format(hours, 'hour');
  }
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  if (Math.abs(days) < 365) return relative.format(Math.round(days / 30), 'month');
  return relative.format(Math.round(days / 365), 'year');
}

export function formatDate(date: string | null): string {
  return date ? longDate.format(new Date(date)) : '—';
}

/** Descarga un Blob como archivo. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileNameOf(header: string | null): string | null {
  return header?.match(/filename="?([^";]+)"?/i)?.[1] ?? null;
}

/** Con responseType blob el error JSON llega como Blob: se lee para traducir el código. */
export async function readBlobError(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) return error;
  try {
    const body: unknown = JSON.parse(await error.error.text());
    return new HttpErrorResponse({ error: body, headers: error.headers, status: error.status, statusText: error.statusText, url: error.url ?? undefined });
  } catch {
    return error;
  }
}

/** Campo marcado por 400 SEGMENT_SETTINGS_INVALID (null si es otro error). */
export function invalidSegmentField(error: unknown): string | null {
  const api = readApiError(error);
  if (api.code !== 'SEGMENT_SETTINGS_INVALID') return null;
  return typeof api.details['field'] === 'string' ? api.details['field'] : 'segments';
}
