export type ConsumptionRange = 'month' | 'prev-month' | 'last-7' | 'custom';

export const CONSUMPTION_RANGES: readonly ConsumptionRange[] = ['month', 'prev-month', 'last-7', 'custom'];

export const RANGE_OPTIONS: ReadonlyArray<Readonly<{ value: ConsumptionRange; label: string }>> = [
  { value: 'month', label: 'Este mes' },
  { value: 'prev-month', label: 'Mes anterior' },
  { value: 'last-7', label: 'Últimos 7 días' },
  { value: 'custom', label: 'Personalizado' },
];

export type DateRange = Readonly<{ dateFrom?: string; dateTo?: string }>;

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Fechas a enviar según el rango. "Este mes" no envía fechas: el backend usa del día 1 del mes a hoy en la zona
 * del negocio. Los otros se calculan en la zona del navegador.
 */
export function rangeDates(range: ConsumptionRange, from: string | null, to: string | null, today = new Date()): DateRange {
  switch (range) {
    case 'prev-month':
      return {
        dateFrom: toIso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        dateTo: toIso(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'last-7':
      return { dateFrom: toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), dateTo: toIso(today) };
    case 'custom':
      return { dateFrom: from ?? undefined, dateTo: to ?? undefined };
    default:
      return {};
  }
}
