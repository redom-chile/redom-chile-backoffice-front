import { PublicScheduleDto } from '../data-access/dtos/public-menu.dto';

/** Límites de POST /bookings (backend: public-bookings.service.ts y table-service-dto.ts). */
export const BOOKING_LIMITS = {
  name: 80,
  note: 300,
  minPhoneDigits: 8,
  maxPhoneDigits: 15,
  minParty: 1,
  maxParty: 20,
  minAheadMinutes: 30,
  maxAheadDays: 60,
} as const;

type Parts = Readonly<{ year: number; month: number; day: number; hour: number; minute: number }>;

/** Crear un Intl.DateTimeFormat es caro: uno por zona (las horas programables de la etapa 5 hacen miles de cálculos). */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function partsIn(ts: number, timeZone: string): Parts {
  const values: Record<string, number> = {};
  const formatter = formatterFor(timeZone);
  for (const p of formatter.formatToParts(new Date(ts))) if (p.type !== 'literal') values[p.type] = Number(p.value);
  return { year: values['year'], month: values['month'], day: values['day'], hour: values['hour'] % 24, minute: values['minute'] };
}

/** Diferencia (ms) entre la hora de la zona y UTC en ese instante (con horario de verano). */
function offsetAt(ts: number, timeZone: string): number {
  const p = partsIn(ts, timeZone);
  const seconds = Math.floor(ts / 1000) * 1000;
  const second = new Date(seconds).getUTCSeconds();
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, second) - seconds;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-14" de hoy (o de hoy + días) en la zona del local. */
export function dateInZone(timeZone: string, addDays = 0, now = Date.now()): string {
  try {
    const p = partsIn(now, timeZone);
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  } catch {
    const d = new Date(now + addDays * 86_400_000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}

/**
 * Fecha "YYYY-MM-DD" y hora "HH:MM" del local → instante (ms). Usa Intl para el desfase de esa fecha (horario de
 * verano incluido). null si la hora no existe ese día (se adelanta el reloj) o los datos no son válidos.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})/.exec(time);
  if (!dm || !tm) return null;
  const [y, mo, d, h, mi] = [+dm[1], +dm[2], +dm[3], +tm[1], +tm[2]];
  const local = Date.UTC(y, mo - 1, d, h, mi);
  try {
    let ts = local - offsetAt(local, timeZone);
    const second = offsetAt(ts, timeZone);
    if (local - second !== ts) ts = local - second;
    const back = partsIn(ts, timeZone);
    if (back.year !== y || back.month !== mo || back.day !== d || back.hour !== h || back.minute !== mi) return null;
    return ts;
  } catch {
    return null;
  }
}

/** Día de la semana (0 domingo) de "YYYY-MM-DD". */
export function weekdayOf(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay() : null;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/**
 * ¿El local atiende a esa hora según su horario? Un rango con cierre menor o igual a la apertura cruza la medianoche
 * (sigue al día siguiente). null: sin horario para decidir.
 */
export function isWithinSchedule(schedule: readonly PublicScheduleDto[], day: number, time: string): boolean | null {
  if (!schedule.length) return null;
  const t = minutes(time);
  const previous = (day + 6) % 7;
  return schedule.some((s) => {
    if (s.isClosed) return false;
    const open = minutes(s.openTime);
    const close = minutes(s.closeTime);
    const overnight = close <= open;
    if (s.dayOfWeek === day) return overnight ? t >= open : t >= open && t < close;
    return overnight && s.dayOfWeek === previous && t < close;
  });
}

/** "sábado 17 de octubre" y "20:30" en la zona del local. */
export function formatBookingDate(iso: string, timeZone: string): Readonly<{ date: string; time: string }> {
  const d = new Date(iso);
  const fmt = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat('es-CL', { ...options, timeZone }).format(d);
    } catch {
      return new Intl.DateTimeFormat('es-CL', options).format(d);
    }
  };
  return { date: fmt({ weekday: 'long', day: 'numeric', month: 'long' }), time: fmt({ hour: '2-digit', minute: '2-digit' }) };
}
