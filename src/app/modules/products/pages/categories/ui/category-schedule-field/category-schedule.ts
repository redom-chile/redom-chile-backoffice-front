import { firstValueFrom } from 'rxjs';
import { ToastService } from 'src/ui';
import { CategoryScheduleRangeDto, MenuSettingsService } from 'src/app/modules/public-menu/data-access';

export type ScheduleRange = { dayOfWeek: number; startTime: string; endTime: string; locationId: number | null };

/** Horario de la categoría en el formulario. `touched`: el usuario lo cambió (sirve cuando no se conoce el actual). */
export type CategorySchedule = Readonly<{ mode: 'all-day' | 'ranges'; ranges: readonly ScheduleRange[]; touched: boolean }>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lunes primero, como se lee la semana; el valor sigue siendo 0 = domingo. */
export const SCHEDULE_DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
] as const;

/** Desde lo que devuelve el backend ('08:00:00' → '08:00'). */
export function toCategorySchedule(ranges: readonly CategoryScheduleRangeDto[] | undefined): CategorySchedule {
  const list = (ranges ?? []).map((range) => ({
    dayOfWeek: range.dayOfWeek,
    startTime: range.startTime.slice(0, 5),
    endTime: range.endTime.slice(0, 5),
    locationId: range.locationId ?? null,
  }));
  return { mode: list.length ? 'ranges' : 'all-day', ranges: list, touched: false };
}

/** Lo que se envía: "Todo el día" es la lista vacía. */
export function toScheduleRanges(schedule: CategorySchedule): CategoryScheduleRangeDto[] {
  if (schedule.mode === 'all-day') return [];
  return schedule.ranges.map(({ dayOfWeek, startTime, endTime, locationId }) => ({
    dayOfWeek,
    startTime,
    endTime,
    ...(locationId ? { locationId } : {}),
  }));
}

/** Error del rango o null. Si termina antes de empezar es válido: cruza la medianoche. */
export function scheduleRangeError(range: ScheduleRange): string | null {
  if (!TIME_PATTERN.test(range.startTime) || !TIME_PATTERN.test(range.endTime)) return 'Indica la hora de inicio y de término.';
  if (range.startTime === range.endTime) return 'El inicio y el término no pueden ser iguales.';
  return null;
}

export function isScheduleValid(schedule: CategorySchedule): boolean {
  return schedule.mode === 'all-day' || schedule.ranges.every((range) => !scheduleRangeError(range));
}

/**
 * ¿Hay que guardar el horario? Con el horario actual conocido, si cambió; si no se conoce (el backend aún no lo
 * devuelve), solo si el usuario lo tocó.
 */
export function scheduleChanged(schedule: CategorySchedule, initial: CategorySchedule | null): boolean {
  if (!initial) return schedule.touched;
  return JSON.stringify(toScheduleRanges(schedule)) !== JSON.stringify(toScheduleRanges(initial));
}

/** Guarda el horario tras guardar la categoría, solo si cambió. Si falla, la categoría ya quedó guardada: se avisa. */
export async function saveCategoryScheduleIfChanged(
  service: MenuSettingsService,
  toast: ToastService,
  categoryId: number | null,
  schedule: CategorySchedule,
  initial: CategorySchedule | null,
): Promise<void> {
  if (!categoryId || !scheduleChanged(schedule, initial)) return;
  try {
    await firstValueFrom(service.setCategorySchedule(categoryId, toScheduleRanges(schedule)));
  } catch {
    toast.show('La categoría se guardó, pero no se pudo guardar el horario', 'warning');
  }
}
