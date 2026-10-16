/** Opciones del botón "Agotar". */
export type SoldOutChoice = 'until-close' | 'until-tomorrow' | 'until-enabled' | 'hide';

export const DEFAULT_TIME_ZONE = 'America/Santiago';

type DateParts = Readonly<{ year: number; month: number; day: number; hour: number; minute: number; second: number }>;

function partsIn(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

/** Diferencia entre la hora de la zona y UTC en ese instante (ms). */
function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/** Fecha y hora de pared en la zona → instante. Se corrige una vez por si cruza un cambio de horario. */
function zonedToInstant(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(guess), timeZone);
  let time = guess - first;
  const second = offsetMs(new Date(time), timeZone);
  if (second !== first) time = guess - second;
  return new Date(time);
}

function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** soldOutUntil en ISO para la opción elegida (null: hasta que lo activen). */
export function soldOutUntilFor(choice: Exclude<SoldOutChoice, 'hide'>, timeZone?: string | null, now = new Date()): string | null {
  if (choice === 'until-enabled') return null;
  const zone = safeZone(timeZone);
  const today = partsIn(now, zone);
  if (choice === 'until-close') return zonedToInstant(today.year, today.month, today.day, 23, 59, zone).toISOString();
  // Mañana: se suma un día en UTC al mediodía para no tropezar con cambios de horario.
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day, 12) + 86_400_000);
  return zonedToInstant(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), 6, 0, zone).toISOString();
}

/** "hasta hoy 23:59" · "hasta mañana 06:00" · "hasta el vie 16 oct, 06:00" · "hasta que lo actives". */
export function formatSoldOutUntil(iso: string | null, timeZone?: string | null, now = new Date()): string {
  if (!iso) return 'hasta que lo actives';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const zone = safeZone(timeZone);
  const time = new Intl.DateTimeFormat('es-CL', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  const target = partsIn(date, zone);
  const today = partsIn(now, zone);
  const days = Math.round(
    (Date.UTC(target.year, target.month - 1, target.day) - Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000,
  );
  if (days === 0) return `hasta hoy ${time}`;
  if (days === 1) return `hasta mañana ${time}`;
  const day = new Intl.DateTimeFormat('es-CL', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' })
    .format(date)
    .replace(/\./g, '')
    .replace(',', '');
  return `hasta el ${day}, ${time}`;
}
