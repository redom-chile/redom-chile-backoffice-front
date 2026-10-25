import { addDays } from 'src/app/modules/public-menu/features/menu-dynamic-shared';

export type SeasonPreset = Readonly<{ label: string; name: string; title: string; startDate: string; endDate: string }>;

const pad = (value: number) => String(value).padStart(2, '0');
const ymd = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** Segundo domingo de mayo (Día de la Madre en Chile). */
function mothersDay(year: number): string {
  const firstWeekday = new Date(Date.UTC(year, 4, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstWeekday) % 7);
  return ymd(year, 5, firstSunday + 7);
}

function lastDayOfFebruary(year: number): number {
  return new Date(Date.UTC(year, 2, 0)).getUTCDate();
}

/** Fechas típicas de Chile; si ya pasaron este año, las del próximo. */
export function seasonPresets(today: string): SeasonPreset[] {
  const year = Number(today.slice(0, 4));
  const pick = (build: (year: number) => Omit<SeasonPreset, 'label'> & { label: string }) => {
    const current = build(year);
    return current.endDate < today ? build(year + 1) : current;
  };
  return [
    pick((y) => ({ label: 'Fiestas Patrias', name: 'Fiestas Patrias', title: 'Para celebrar el 18', startDate: ymd(y, 9, 15), endDate: ymd(y, 9, 21) })),
    pick((y) => ({ label: 'Navidad', name: 'Navidad', title: 'Especial de Navidad', startDate: ymd(y, 12, 15), endDate: ymd(y, 12, 25) })),
    pick((y) => ({ label: 'Verano', name: 'Verano', title: 'Para el calor', startDate: ymd(y, 1, 1), endDate: ymd(y, 2, lastDayOfFebruary(y)) })),
    pick((y) => {
      const sunday = mothersDay(y);
      return { label: 'Día de la Madre', name: 'Día de la Madre', title: 'Para mamá', startDate: addDays(sunday, -6), endDate: sunday };
    }),
  ];
}
