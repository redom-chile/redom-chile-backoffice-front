import { formatDay } from '../payable-payments/payable-format';

/** "Hasta 07 oct 2026" (todas las pendientes) · "01 oct 2026 – 07 oct 2026". */
export function tipPeriodLabel(dateFrom: string | null | undefined, dateTo: string | null | undefined): string {
  if (!dateFrom) return dateTo ? `Hasta ${formatDay(dateTo)}` : 'Todas las pendientes';
  if (!dateTo || dateFrom === dateTo) return formatDay(dateFrom);
  return `${formatDay(dateFrom)} – ${formatDay(dateTo)}`;
}
