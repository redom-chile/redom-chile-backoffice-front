import { isPlanError } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { ApiKeyKind, getPublicMenuErrorMessage, WebhookDeliveryDto, WebhookEvent } from 'src/app/modules/public-menu/data-access';

export const MAX_ORIGINS = 10;

export const KEY_KIND_LABELS: Record<ApiKeyKind, string> = { publishable: 'Publicable', secret: 'Secreta' };

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent | 'ping', string> = {
  'order.created': 'Pedido creado',
  'order.accepted': 'Pedido aceptado',
  'order.rejected': 'Pedido rechazado',
  'order.cancelled': 'Pedido cancelado',
  'order.ready': 'Pedido listo',
  'order.on_the_way': 'Pedido en camino',
  'order.completed': 'Pedido entregado',
  ping: 'Prueba (ping)',
};

/** Solo ocurren en retiro y delivery. */
export const FULFILLMENT_ONLY_EVENTS: ReadonlySet<string> = new Set(['order.ready', 'order.on_the_way', 'order.completed']);

export const DELIVERY_STATUS_LABELS: Record<WebhookDeliveryDto['status'], string> = {
  pending: 'Pendiente',
  delivered: 'Entregado',
  failed: 'Fallido',
};

export const DELIVERY_STATUS_CLASSES: Record<WebhookDeliveryDto['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  delivered: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export function eventLabel(event: string): string {
  return WEBHOOK_EVENT_LABELS[event as WebhookEvent] ?? event;
}

const relative = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' });

export function formatRelative(date: string | null, now = Date.now()): string {
  if (!date) return 'Nunca';
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  if (Math.abs(seconds) < 60) return 'hace un momento';
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relative.format(months, 'month');
  return relative.format(Math.round(days / 365), 'year');
}

export function formatDateTime(date: string | null): string {
  return date ? dateTime.format(new Date(date)) : '—';
}

/** Normaliza un origen como el backend (scheme://host[:port]). Devuelve el problema si no es válido. */
export function normalizeOrigin(value: string): { origin: string } | { error: string } {
  const raw = value.trim();
  if (!raw) return { error: 'Ingresa un origen.' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: `"${raw}" no es una dirección válida. Ej: https://www.tusitio.cl` };
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return { origin: url.origin };
  if (url.protocol === 'http:') return { error: 'Usa https:// (http solo para localhost).' };
  return { error: `"${raw}" no es una dirección web.` };
}

/** https y no local (el backend además exige que sea pública). */
export function webhookUrlProblem(value: string): string | null {
  const raw = value.trim();
  if (!raw) return 'Ingresa la URL.';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'No es una URL válida. Ej: https://api.tusitio.cl/webhooks/redom';
  }
  if (url.protocol !== 'https:') return 'La URL debe usar https://';
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return 'Usa una dirección pública, no localhost.';
  return null;
}

/** Mensaje para un error de la API pública; null si es de plan (ya lo muestra el modal global). */
export function publicApiError(error: unknown, fallback: string): string | null {
  if (isPlanError(error)) return null;
  const api = readApiError(error);
  if (api.code) return getPublicMenuErrorMessage(error, fallback);
  if (api.status === 0) return 'No hay conexión con el servidor.';
  if (api.status === 403) return 'No tienes permiso para hacer este cambio.';
  if (api.status === 404) return 'Ya no existe. Recarga la página.';
  const message = api.message;
  if (api.status === 409) {
    if (/active keys/i.test(message)) return 'Puedes tener hasta 10 llaves activas: revoca una primero.';
    if (/webhook endpoints/i.test(message)) return 'Puedes tener hasta 5 webhooks: elimina uno primero.';
    if (/disabled/i.test(message)) return 'El webhook está desactivado: actívalo para probarlo.';
    return fallback;
  }
  if (api.status === 400) {
    if (/must use https/i.test(message)) return 'Los orígenes deben usar https:// (http solo para localhost).';
    if (/Invalid origin/i.test(message)) return 'Hay un origen que no es válido.';
    if (/allowed origins per key/i.test(message)) return 'Hasta 10 orígenes por llave.';
    if (/needs its allowed origins/i.test(message)) return 'Una llave publicable necesita al menos un origen.';
    if (/name is required/i.test(message)) return 'Ingresa un nombre.';
    if (/events is required/i.test(message)) return 'Elige al menos un evento.';
    if (/url/i.test(message)) return 'La URL debe ser https y pública.';
    return 'Revisa los datos del formulario: hay un valor que no es válido.';
  }
  return fallback;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
