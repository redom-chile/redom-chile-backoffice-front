import { isoToLocalInput, localInputToIso } from 'src/app/modules/public-menu/features/menu-design-shared';
import { safeZone } from 'src/app/modules/public-menu/features/marketing-schedule-field';

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const pad = (value: number) => String(value).padStart(2, '0');

/** 'YYYY-MM-DD' de hoy en la zona del negocio. */
export function todayIn(timeZone: string | null | undefined): string {
  return isoToLocalInput(new Date().toISOString(), timeZone).slice(0, 10);
}

/** 'YYYY-MM-DD' + n días (calendario, sin zona). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`;
}

/** ISO → { date: 'YYYY-MM-DD', time: 'HH:MM' } en la zona del negocio. */
export function splitIso(iso: string | null | undefined, timeZone: string | null | undefined): { date: string; time: string } {
  const local = isoToLocalInput(iso, timeZone);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** Fecha y hora de pared en la zona del negocio → ISO con su offset. */
export function joinIso(date: string, time: string, timeZone: string | null | undefined): string | null {
  return localInputToIso(`${date}T${time}`, timeZone);
}

/** Fin del día en la zona (23:59:59.999), para que el último día cuente completo. */
export function endOfDayIso(date: string, timeZone: string | null | undefined): string | null {
  const iso = joinIso(date, '23:59', timeZone);
  return iso ? new Date(new Date(iso).getTime() + 59_999).toISOString() : null;
}

/** "lun 15 sep" (o "15 sep 2027" si es de otro año). */
export function formatShortDay(date: string, timeZone: string | null | undefined, withWeekday = true): string {
  const iso = joinIso(date, '12:00', timeZone);
  if (!iso) return date;
  const sameYear = date.slice(0, 4) === todayIn(timeZone).slice(0, 4);
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: safeZone(timeZone),
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
    .format(new Date(iso))
    .replace(/\./g, '')
    .replace(',', '');
}

/** "HH:MM" → minutos del día. */
export const toMinutes = (time: string) => {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
