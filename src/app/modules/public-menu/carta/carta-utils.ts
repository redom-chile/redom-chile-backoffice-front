import { InjectionToken } from '@angular/core';
import { readApiError } from 'src/app/core/utils/api-error';
import { PublicCategoryRangeDto, PublicLocationDto, PublicScheduleDto } from '../data-access/dtos/public-menu.dto';
import { formatTime } from '../data-access/public-menu-format';
import { cartaDayName, cartaDayShort, ct } from './carta-i18n';

/** Ruta donde se monta la carta (la landing la monta en /carta). */
export const CARTA_BASE_PATH = new InjectionToken<string>('CARTA_BASE_PATH', { providedIn: 'root', factory: () => '/carta' });

export type CartaLoadError =
  | Readonly<{ kind: 'moved'; path: string }>
  | Readonly<{ kind: 'not-found' }>
  | Readonly<{ kind: 'rate-limited' }>
  | Readonly<{ kind: 'error'; offline: boolean }>;

/** Traduce el error de la API pública. MENU_MOVED llega como 301 con cuerpo JSON (sin cabecera Location). */
export function readCartaError(error: unknown, basePath: string): CartaLoadError {
  const api = readApiError(error);
  const redirectTo = api.details['redirectTo'];
  if ((api.code === 'MENU_MOVED' || api.status === 301) && typeof redirectTo === 'string' && redirectTo.startsWith('/menus/')) {
    return { kind: 'moved', path: basePath + redirectTo.slice('/menus'.length) };
  }
  if (api.code === 'RATE_LIMITED' || api.status === 429) return { kind: 'rate-limited' };
  if (api.code === 'MENU_NOT_FOUND' || api.status === 404 || api.status === 400) return { kind: 'not-found' };
  return { kind: 'error', offline: api.status === 0 };
}

// --- Enlaces del encabezado ---

export const whatsappUrl = (value: string) => `https://wa.me/${value.replace(/\D/g, '')}`;

export const phoneUrl = (value: string) => `tel:${value.replace(/[^\d+]/g, '')}`;

export function instagramUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '').replace(/^(www\.)?instagram\.com\//i, '').replace(/\/+$/, '');
  return `https://instagram.com/${handle}`;
}

export const websiteUrl = (value: string) => (/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);

export const websiteLabel = (value: string) => value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');

export function mapsUrl(location: Pick<PublicLocationDto, 'latitude' | 'longitude' | 'address'>): string | null {
  const { latitude, longitude, address } = location;
  if (latitude != null && longitude != null) return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
}

// --- Horarios ---

/** Lunes primero, como se lee en Chile. */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

/** Día de la semana (0 domingo) en la zona horaria del local. */
export function todayIn(timeZone: string): number {
  try {
    const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(new Date());
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
  } catch {
    return new Date().getDay();
  }
}

export type ScheduleRow = Readonly<{ day: number; name: string; hours: string; closed: boolean }>;

/** Una fila por día; si el día no aparece o tiene isClosed → "Cerrado". En el idioma activo (llamar dentro de computed). */
export function buildWeekSchedule(schedule: readonly PublicScheduleDto[]): ScheduleRow[] {
  return WEEK_ORDER.map((day) => {
    const open = schedule
      .filter((s) => s.dayOfWeek === day && !s.isClosed)
      .sort((a, b) => a.openTime.localeCompare(b.openTime));
    return {
      day,
      name: cartaDayName(day),
      closed: open.length === 0,
      hours: open.length ? open.map((s) => `${formatTime(s.openTime)} – ${formatTime(s.closeTime)}`).join(', ') : ct('common.closed'),
    };
  });
}

/** "Lun a Vie", "Lun, Mié y Vie", "Todos los días". */
function daysLabel(days: readonly number[]): string {
  const ordered = WEEK_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 7) return ct('schedule.everyDay');
  const runs: number[][] = [];
  for (const day of ordered) {
    const last = runs.at(-1);
    const prev = last?.at(-1);
    if (last && prev !== undefined && WEEK_ORDER.indexOf(day) === WEEK_ORDER.indexOf(prev) + 1) last.push(day);
    else runs.push([day]);
  }
  const parts = runs.flatMap((run) =>
    run.length >= 3 ? [ct('schedule.dayRun', { from: cartaDayShort(run[0]), to: cartaDayShort(run.at(-1)!) })] : run.map(cartaDayShort),
  );
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${ct('schedule.and')} ${parts.at(-1)}` : parts[0];
}

/** "Disponible Lun a Vie de 08:00 a 11:30 · Sáb de 20:00 a 02:00". Un rango con fin menor al inicio cruza la medianoche. */
export function categoryAvailabilityText(schedule: readonly PublicCategoryRangeDto[] | null): string {
  if (!schedule?.length) return ct('schedule.unavailable');
  const groups = new Map<string, number[]>();
  for (const range of schedule) {
    const key = `${formatTime(range.startTime)}|${formatTime(range.endTime)}`;
    const days = groups.get(key) ?? [];
    if (!days.includes(range.dayOfWeek)) days.push(range.dayOfWeek);
    groups.set(key, days);
  }
  const firstDay = (days: number[]) => Math.min(...days.map((d) => WEEK_ORDER.indexOf(d)));
  const parts = [...groups.entries()]
    .sort(([ka, a], [kb, b]) => firstDay(a) - firstDay(b) || ka.localeCompare(kb))
    .map(([key, days]) => {
      const [start, end] = key.split('|');
      return ct('schedule.hours', { days: daysLabel(days), start, end });
    });
  return ct('schedule.available', { parts: parts.join(' · ') });
}

/** Iniciales para el logo de respaldo. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
