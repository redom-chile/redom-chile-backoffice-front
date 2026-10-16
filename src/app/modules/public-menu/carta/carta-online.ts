import { readApiError } from 'src/app/core/utils/api-error';
import { OnlineChannel, OnlinePaymentMethod, PublicOnlineDto } from '../data-access/dtos/online-orders.dto';
import { PublicLocationDto } from '../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../data-access/public-menu-format';
import { dateInZone, isWithinSchedule, weekdayOf, zonedToUtc } from './carta-booking';
import { OrderSendError, readOrderError } from './carta-cart';
import { cartaLocale, CartaKey, ct } from './carta-i18n';

/** Carta pública, etapa 5: retiro y delivery. Límites de customer-orders-dto.ts. */
export const ONLINE_LIMITS = {
  name: 80,
  minPhoneDigits: 8,
  maxPhoneDigits: 15,
  email: 120,
  street: 120,
  number: 20,
  details: 120,
  maxAheadDays: 7,
  /** Cada cuántos minutos se ofrecen horas programadas. */
  slotMinutes: 15,
} as const;

/** Comprobante de transferencia: imagen o PDF de hasta 5 MB. */
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const RECEIPT_EXTENSIONS: Readonly<Record<string, (typeof RECEIPT_TYPES)[number]>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Tipo del comprobante. Algunos navegadores móviles dan type vacío o "image/jpg": se deduce de la extensión. */
export function receiptContentType(file: Pick<File, 'type' | 'name'>): (typeof RECEIPT_TYPES)[number] | null {
  const type = file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase();
  const known = RECEIPT_TYPES.find((t) => t === type);
  if (known) return known;
  return RECEIPT_EXTENSIONS[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}

/** Objeto de getters: cada lectura sale en el idioma activo. */
function translatedLabels<T extends string>(keys: readonly T[], prefix: string): Readonly<Record<T, string>> {
  const labels = {} as Record<T, string>;
  for (const key of keys) Object.defineProperty(labels, key, { enumerable: true, get: () => ct(`${prefix}${key}` as CartaKey) });
  return labels;
}

export const CHANNEL_LABELS = translatedLabels<OnlineChannel>(['pickup', 'delivery'], 'online.channel.');

export const PAYMENT_LABELS = translatedLabels<OnlinePaymentMethod>(
  ['transfer_receipt', 'cash_on_pickup', 'card_on_pickup', 'cash_on_delivery', 'card_on_delivery'],
  'online.payment.',
);

/** Métodos que sirven para el canal (los "_on_pickup" solo en retiro; los "_on_delivery" solo en delivery). */
export function methodsFor(methods: readonly OnlinePaymentMethod[], channel: OnlineChannel): OnlinePaymentMethod[] {
  return methods.filter((m) => (m.endsWith('_on_pickup') ? channel === 'pickup' : m.endsWith('_on_delivery') ? channel === 'delivery' : true));
}

// --- Datos del cliente (localStorage redom-customer) ---

const CUSTOMER_KEY = 'redom-customer';

export type SavedCustomer = Readonly<{ name: string; phone: string; email: string }>;

export function readSavedCustomer(): SavedCustomer {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? 'null') as Record<string, unknown> | null;
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
    return { name: text(raw?.['name'], ONLINE_LIMITS.name), phone: text(raw?.['phone'], 24), email: text(raw?.['email'], ONLINE_LIMITS.email) };
  } catch {
    return { name: '', phone: '', email: '' };
  }
}

export function saveCustomer(customer: SavedCustomer): void {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  } catch {
    // Modo privado o almacenamiento lleno: la próxima vez se vuelven a escribir
  }
}

export const phoneDigits = (phone: string) => phone.replace(/\D/g, '').length;
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// --- Zonas de reparto ---

export type DeliveryZone = PublicOnlineDto['deliveryZones'][number];

/** Comunas de las zonas, sin repetir y por nombre. */
export function zoneCommunes(online: PublicOnlineDto): ReadonlyArray<Readonly<{ id: number; name: string }>> {
  const map = new Map<number, string>();
  for (const z of online.deliveryZones) for (const c of z.communes) if (!map.has(c.id)) map.set(c.id, c.name);
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

type Coords = Readonly<{ latitude: number; longitude: number }>;

/** Distancia en km entre dos puntos (haversine). */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type ZoneEstimate =
  | Readonly<{ kind: 'zone'; zone: DeliveryZone }>
  /** Hay zonas por radio y falta la ubicación: el envío se calcula al confirmar. */
  | Readonly<{ kind: 'pending' }>
  | Readonly<{ kind: 'outside' }>
  | Readonly<{ kind: 'none' }>;

/**
 * La zona que corresponde, como la elige el backend (delivery-zones.service.ts → match): la primera, en orden, que
 * incluye la comuna o, si es por radio, que cubre la ubicación medida desde el local. El backend confirma.
 */
export function estimateZone(
  online: PublicOnlineDto,
  location: Pick<PublicLocationDto, 'latitude' | 'longitude'>,
  communeId: number | null,
  coords: Coords | null,
): ZoneEstimate {
  if (communeId == null) return { kind: 'none' };
  const origin = location.latitude != null && location.longitude != null ? { latitude: location.latitude, longitude: location.longitude } : null;
  const zone = online.deliveryZones.find((z) => {
    if (z.communes.some((c) => c.id === communeId)) return true;
    return !!z.radiusKm && !!coords && !!origin && distanceKm(origin, coords) <= Number(z.radiusKm);
  });
  if (zone) return { kind: 'zone', zone };
  const radius = online.deliveryZones.some((z) => !!z.radiusKm);
  // Sin coordenadas del local, el backend no puede medir: las zonas por radio no aplican
  return radius && origin && !coords ? { kind: 'pending' } : { kind: 'outside' };
}

// --- Hora del pedido ---

export type ScheduleDay = Readonly<{ date: string; label: string; slots: ReadonlyArray<Readonly<{ time: string; iso: string }>> }>;

const pad = (n: number) => String(n).padStart(2, '0');

function dayLabel(date: string, index: number): string {
  if (index === 0) return ct('online.today');
  if (index === 1) return ct('online.tomorrow');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  // Mediodía UTC del día: el nombre del día no depende de la zona del navegador
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const text = new Intl.DateTimeFormat(cartaLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Horas programables: desde ahora + prepMinutes hasta 7 días, cada 15 minutos, dentro del horario del local (en su
 * zona horaria). Sin horario cargado, cualquier hora del plazo.
 */
export function scheduleDays(location: Pick<PublicLocationDto, 'timeZone' | 'schedule'>, prepMinutes: number, now = Date.now()): ScheduleDay[] {
  const tz = location.timeZone;
  const from = now + prepMinutes * 60_000;
  const to = now + ONLINE_LIMITS.maxAheadDays * 86_400_000;
  const days: ScheduleDay[] = [];
  for (let i = 0; i <= ONLINE_LIMITS.maxAheadDays; i++) {
    const date = dateInZone(tz, i, now);
    const weekday = weekdayOf(date);
    if (weekday == null) continue;
    const slots: { time: string; iso: string }[] = [];
    for (let minute = 0; minute < 24 * 60; minute += ONLINE_LIMITS.slotMinutes) {
      const time = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
      // Primero el horario (barato); luego el instante en la zona del local
      if (isWithinSchedule(location.schedule, weekday, time) === false) continue;
      const ts = zonedToUtc(date, time, tz);
      if (ts == null || ts < from || ts > to) continue;
      slots.push({ time, iso: new Date(ts).toISOString() });
    }
    if (slots.length) days.push({ date, label: dayLabel(date, i), slots });
  }
  return days;
}

/** "hoy a las 20:30" / "el sábado 17 de octubre a las 20:30" en la zona del local. */
export function formatScheduled(iso: string, timeZone: string, now = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // es-CL para comparar fechas; el idioma activo solo para mostrar
  const fmt = (options: Intl.DateTimeFormatOptions, locale = 'es-CL') => {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d);
    } catch {
      return new Intl.DateTimeFormat(locale, options).format(d);
    }
  };
  const time = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const day = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const sameDay = (offset: number) => {
    try {
      return new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(now + offset * 86_400_000));
    } catch {
      return '';
    }
  };
  if (day === sameDay(0)) return ct('online.scheduled.today', { time });
  if (day === sameDay(1)) return ct('online.scheduled.tomorrow', { time });
  return ct('online.scheduled.day', { day: fmt({ weekday: 'long', day: 'numeric', month: 'long' }, cartaLocale()), time });
}

// --- Errores de POST /orders sin QR ---

export type OnlineOrderError = OrderSendError &
  Readonly<{
    /** PAYMENT_METHOD_NOT_ACCEPTED: los que acepta (details.accepted). */
    accepted?: OnlinePaymentMethod[];
    /** El error es del carrito: volver a revisarlo. */
    cart?: boolean;
  }>;

export function readOnlineOrderError(error: unknown, channel: OnlineChannel, scheduled: boolean, fallbackPrep: number): OnlineOrderError {
  const api = readApiError(error);
  const d = api.details;
  switch (api.code) {
    case 'ORDERING_DISABLED':
      return { message: channel === 'pickup' ? ct('online.error.orderingPickup') : ct('online.error.orderingDelivery'), reload: true };
    case 'PAYMENT_METHOD_NOT_ACCEPTED': {
      const accepted = Array.isArray(d['accepted']) ? (d['accepted'] as unknown[]).filter((m): m is OnlinePaymentMethod => typeof m === 'string' && m in PAYMENT_LABELS) : undefined;
      return { message: ct('online.error.payment'), accepted };
    }
    case 'ORDER_SCHEDULE_INVALID': {
      const prep = Number(d['prepMinutes']);
      return { message: ct('online.error.schedule', { prep: Number.isFinite(prep) ? prep : fallbackPrep }) };
    }
    case 'LOCATION_CLOSED':
      return { message: scheduled ? ct('online.error.closedAtTime') : ct('online.error.closedNow') };
    case 'OUTSIDE_DELIVERY_AREA':
      return { message: ct('online.error.outside') };
    case 'BELOW_MINIMUM_ORDER': {
      const min = Number(d['minOrder']);
      return { message: Number.isFinite(min) ? ct('online.error.minimum', { min: formatMenuPrice(min) }) : ct('online.error.minimumGeneric') };
    }
    case 'TOO_MANY_PENDING_ORDERS':
      return { message: ct('online.error.pending') };
    case 'MENU_NOT_FOUND':
      return { message: ct('online.error.notFound') };
    case 'PRODUCT_UNAVAILABLE':
    case 'PACK_CHOICES_INVALID':
    case 'ORDER_TOO_LARGE':
    case 'MODIFIER_NOT_AVAILABLE':
    case 'MODIFIER_REPEATED':
      return { ...readOrderError(error), cart: true };
  }
  if (api.status === 400) return { message: ct('online.error.invalid') };
  return readOrderError(error);
}
