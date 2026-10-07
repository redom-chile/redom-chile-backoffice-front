import { readApiError } from 'src/app/core/utils/api-error';
import { getInventoryErrorMessage } from '../../../data-access';

/** Mensaje del error de carga del reporte; el 400 de fechas se traduce aquí. */
export function getConsumptionErrorMessage(error: unknown): string {
  const { message } = readApiError(error);
  if (/dateFrom cannot be after dateTo/i.test(message ?? '')) return 'La fecha "Desde" no puede ser posterior a "Hasta".';
  if (/date(From|To)/i.test(message ?? '')) return 'Revisa las fechas del período.';
  return getInventoryErrorMessage(error);
}
