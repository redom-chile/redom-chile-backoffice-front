import { DAY_SHORT, formatTime, MenuScheduleFieldsDto } from 'src/app/modules/public-menu/data-access';

export const DEFAULT_TIME_ZONE = 'America/Santiago';

/** Lo que edita el formulario: fechas 'YYYY-MM-DD', horas 'HH:MM' ('' = sin valor). */
export type ScheduleFormValue = Readonly<{
  startDate: string;
  endDate: string;
  days: readonly number[];
  startTime: string;
  endTime: string;
}>;

export const EMPTY_SCHEDULE: ScheduleFormValue = { startDate: '', endDate: '', days: [], startTime: '', endTime: '' };

/** Lunes primero, como en Chile. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

type ScheduleEntity = Readonly<{
  startsAt: string | null;
  endsAt: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
}>;

type Parts = Readonly<{ year: number; month: number; day: number; hour: number; minute: number; weekday: number }>;

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function partsIn(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '0';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    weekday: WEEKDAYS[value('weekday')] ?? 0,
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - (date.getTime() - (date.getTime() % 60_000));
}

/** Fecha y hora de pared en la zona → instante (se corrige una vez por cambios de horario). */
function zonedToInstant(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(guess), timeZone);
  let time = guess - first;
  const second = offsetMs(new Date(time), timeZone);
  if (second !== first) time = guess - second;
  return new Date(time);
}

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO → 'YYYY-MM-DD' en la zona del negocio. */
function toDateInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsIn(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function fromDateInput(value: string, timeZone: string, endOfDay: boolean): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  return zonedToInstant(y, m, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, timeZone).toISOString();
}

export function scheduleFromEntity(entity: ScheduleEntity | null | undefined, timeZone?: string | null): ScheduleFormValue {
  if (!entity) return EMPTY_SCHEDULE;
  const zone = safeZone(timeZone);
  return {
    startDate: toDateInput(entity.startsAt, zone),
    endDate: toDateInput(entity.endsAt, zone),
    days: entity.daysOfWeek?.length && entity.daysOfWeek.length < 7 ? [...entity.daysOfWeek] : [],
    startTime: entity.startTime ? formatTime(entity.startTime) : '',
    endTime: entity.endTime ? formatTime(entity.endTime) : '',
  };
}

/** Todas las claves del horario (null limpia). La fecha de término cubre el día completo. */
export function scheduleToDto(value: ScheduleFormValue, timeZone?: string | null): Required<MenuScheduleFieldsDto> {
  const zone = safeZone(timeZone);
  const days = value.days.length && value.days.length < 7 ? [...value.days].sort((a, b) => a - b) : null;
  return {
    startsAt: fromDateInput(value.startDate, zone, false),
    endsAt: fromDateInput(value.endDate, zone, true),
    daysOfWeek: days,
    startTime: value.startTime || null,
    endTime: value.endTime || null,
  };
}

export function sameSchedule(a: ScheduleFormValue, b: ScheduleFormValue): boolean {
  const days = (list: readonly number[]) => [...list].sort((x, y) => x - y).join(',');
  return (
    a.startDate === b.startDate && a.endDate === b.endDate && days(a.days) === days(b.days) && a.startTime === b.startTime && a.endTime === b.endTime
  );
}

/** Mensaje si el horario no es válido; null si está bien. */
export function scheduleProblem(value: ScheduleFormValue): string | null {
  if (!!value.startTime !== !!value.endTime) return 'Indica la hora de inicio y la de término, o ninguna.';
  if (value.startTime && value.startTime === value.endTime) return 'La hora de término debe ser distinta a la de inicio.';
  if (value.startDate && value.endDate && value.endDate < value.startDate) return 'La fecha de término no puede ser anterior a la de inicio.';
  return null;
}

export const crossesMidnight = (startTime: string | null | undefined, endTime: string | null | undefined) =>
  !!startTime && !!endTime && endTime.slice(0, 5) < startTime.slice(0, 5);

/** "Lun a Vie", "Lun, Mié y Vie", "Todos los días". */
export function formatDays(days: readonly number[] | null | undefined): string {
  if (!days?.length || days.length >= 7) return 'Todos los días';
  const ordered = WEEK_ORDER.filter((day) => days.includes(day));
  const indexes = ordered.map((day) => WEEK_ORDER.indexOf(day));
  const consecutive = indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1);
  if (consecutive && ordered.length >= 3) return `${DAY_SHORT[ordered[0]]} a ${DAY_SHORT[ordered[ordered.length - 1]]}`;
  const names = ordered.map((day) => DAY_SHORT[day]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function formatShortDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-CL', { timeZone, day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\./g, '');
}

/** "Lun a Vie · 12:00 a 16:00 · del 20 oct al 1 nov"; "Siempre" sin horario. */
export function formatSchedule(entity: ScheduleEntity, timeZone?: string | null): string {
  const zone = safeZone(timeZone);
  const parts: string[] = [];
  const hasDays = !!entity.daysOfWeek?.length && entity.daysOfWeek.length < 7;
  if (hasDays || entity.startTime) parts.push(formatDays(entity.daysOfWeek));
  if (entity.startTime && entity.endTime) {
    const hours = `${formatTime(entity.startTime)} a ${formatTime(entity.endTime)}`;
    parts.push(crossesMidnight(entity.startTime, entity.endTime) ? `${hours} (del día siguiente)` : hours);
  }
  if (entity.startsAt && entity.endsAt) parts.push(`del ${formatShortDate(entity.startsAt, zone)} al ${formatShortDate(entity.endsAt, zone)}`);
  else if (entity.startsAt) parts.push(`desde el ${formatShortDate(entity.startsAt, zone)}`);
  else if (entity.endsAt) parts.push(`hasta el ${formatShortDate(entity.endsAt, zone)}`);
  return parts.length ? parts.join(' · ') : 'Siempre';
}

export type ScheduleStatus = 'live' | 'upcoming' | 'ended' | 'off-hours';

/** Si vale ahora, en la zona del negocio. */
export function scheduleStatus(entity: ScheduleEntity, timeZone?: string | null, now = new Date()): ScheduleStatus {
  if (entity.startsAt && new Date(entity.startsAt) > now) return 'upcoming';
  if (entity.endsAt && new Date(entity.endsAt) <= now) return 'ended';
  const days = entity.daysOfWeek?.length ? entity.daysOfWeek : null;
  const p = partsIn(now, safeZone(timeZone));
  const onDay = (weekday: number) => !days || days.includes(weekday);
  if (!entity.startTime || !entity.endTime) return onDay(p.weekday) ? 'live' : 'off-hours';
  const time = `${pad(p.hour)}:${pad(p.minute)}`;
  const start = entity.startTime.slice(0, 5);
  const end = entity.endTime.slice(0, 5);
  if (start <= end) return onDay(p.weekday) && time >= start && time < end ? 'live' : 'off-hours';
  // Cruza la medianoche: el tramo de madrugada pertenece al día anterior.
  if (time >= start && onDay(p.weekday)) return 'live';
  if (time < end && onDay((p.weekday + 6) % 7)) return 'live';
  return 'off-hours';
}

export const SCHEDULE_STATUS_LABELS: Record<Exclude<ScheduleStatus, 'live'>, string> = {
  upcoming: 'Aún no comienza',
  ended: 'Terminó',
  'off-hours': 'Fuera de horario ahora',
};
