import { MENU_CATEGORY_ICONS, MenuMomentDto, MenuMomentMode } from 'src/app/modules/public-menu/data-access';
import { toMinutes } from 'src/app/modules/public-menu/features/menu-dynamic-shared';

export const MOMENT_MODE_LABELS: Record<MenuMomentMode, string> = { highlight: 'Destacar', only: 'Mostrar solo esto' };
export const MOMENT_MODE_HINTS: Record<MenuMomentMode, string> = {
  highlight: 'Sus categorías y productos suben al inicio de la carta; el resto se sigue viendo.',
  only: 'Mientras dura, la carta muestra solo lo del momento. Fuera de ese horario se ve completa.',
};

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAYS = [1, 2, 3, 4, 5];

export type MomentPreset = Readonly<{ label: string; name: string; icon: string; startTime: string; endTime: string; days: readonly number[] }>;

export const MOMENT_PRESETS: readonly MomentPreset[] = [
  { label: 'Desayuno 08:00–11:30', name: 'Desayuno', icon: 'egg', startTime: '08:00', endTime: '11:30', days: ALL_DAYS },
  { label: 'Almuerzo 12:00–15:30', name: 'Almuerzo', icon: 'utensils', startTime: '12:00', endTime: '15:30', days: WEEKDAYS },
  { label: 'Once 16:00–19:00', name: 'Once', icon: 'coffee', startTime: '16:00', endTime: '19:00', days: ALL_DAYS },
  { label: 'Happy hour 18:00–21:00', name: 'Happy hour', icon: 'beer', startTime: '18:00', endTime: '21:00', days: ALL_DAYS },
];

const ICON_LABELS = new Map<string, string>(MENU_CATEGORY_ICONS.map((icon) => [icon.name, icon.label]));
export const momentIconLabel = (icon: string | null) => (icon ? (ICON_LABELS.get(icon) ?? null) : null);

const WEEK = 7 * 1440;

/** Tramos de la semana en minutos (un horario que cruza la medianoche sigue en el día siguiente). */
function weeklyRanges(days: readonly number[], startTime: string, endTime: string): Array<[number, number]> {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const length = end > start ? end - start : end + 1440 - start;
  return days.flatMap((day): Array<[number, number]> => {
    const from = day * 1440 + start;
    const to = from + length;
    return to <= WEEK ? [[from, to]] : [
        [from, WEEK],
        [0, to - WEEK],
      ];
  });
}

type MomentTimes = Readonly<{ days: readonly number[]; startTime: string; endTime: string }>;

export function momentsOverlap(a: MomentTimes, b: MomentTimes): boolean {
  const left = weeklyRanges(a.days, a.startTime, a.endTime);
  const right = weeklyRanges(b.days, b.startTime, b.endTime);
  return left.some(([aFrom, aTo]) => right.some(([bFrom, bTo]) => aFrom < bTo && bFrom < aTo));
}

/** Primer momento activo del local que se cruza con este horario. */
export function findOverlap(moments: readonly MenuMomentDto[], candidate: MomentTimes, exceptId: number | null): MenuMomentDto | null {
  return moments.find((moment) => moment.id !== exceptId && moment.isActive && momentsOverlap(moment, candidate)) ?? null;
}
