import { readApiError } from 'src/app/core/utils/api-error';
import { getCashErrorMessage } from 'src/app/modules/cash/data-access';

const BY_CODE: Record<string, string> = {
  PAYABLE_AMOUNT_EXCEEDED: 'El monto supera lo que se debe.',
  EXPENSE_HAS_PAYMENTS: 'El gasto tiene pagos: anúlalos primero.',
  NO_TIPS_TO_PAY: 'No hay propinas pendientes en ese período.',
  TIP_ALREADY_PAID_OUT: 'La propina de este pago ya se liquidó: anula primero la liquidación.',
};

const BY_MESSAGE: ReadonlyArray<[RegExp, string]> = [
  [/expense category with that name already exists/i, 'Ya existe una categoría con ese nombre.'],
  [/Expense category not found/i, 'La categoría no existe o está desactivada.'],
  [/vatAmount cannot exceed amount/i, 'El IVA no puede ser mayor que el monto.'],
  [/amount cannot be lower than what is paid/i, 'El monto no puede ser menor que lo ya pagado.'],
  [/location cannot change once the expense has payments/i, 'No se puede cambiar el local de un gasto con pagos.'],
  [/expense is already cancelled|expense is cancelled/i, 'El gasto está anulado.'],
  [/void them before cancelling/i, 'El gasto tiene pagos: anúlalos primero.'],
  [/It is already paid/i, 'Ya está pagado.'],
  [/amount exceeds what is owed/i, 'El monto supera el saldo pendiente.'],
  [/amount must be greater than zero/i, 'El monto debe ser mayor a cero.'],
  [/payment is already cancelled/i, 'El pago ya estaba anulado.'],
  [/put the cash back/i, 'Abre la caja para devolver el efectivo.'],
  [/dateFrom cannot be after dateTo/i, 'La fecha "desde" no puede ser posterior a "hasta".'],
  [/participant is repeated/i, 'Hay un participante repetido.'],
  [/Participant not found/i, 'Uno de los participantes ya no pertenece al negocio. Recarga la lista.'],
  [/Send the participants with their points/i, 'En el reparto por puntos agrega a los participantes con sus puntos.'],
  [/points must add up to more than 0/i, 'Los puntos deben sumar más que 0.'],
  [/tips of orders without waiter: send the participants/i, 'Hay propinas de pedidos sin mesero: agrega a quienes las comparten.'],
  [/Send the participants who share the tips/i, 'Agrega a los participantes del reparto (no hay meseros con propinas).'],
  [/Cash payouts need the cash register/i, 'Para pagar en efectivo elige el local o la caja.'],
  [/tip payout is already cancelled/i, 'La liquidación ya estaba anulada.'],
  [/Tip payout not found/i, 'No encontramos esa liquidación.'],
  [/Weekly: dayOfPeriod/i, 'En semanal, el día va de 1 (lunes) a 7 (domingo).'],
  [/endDate cannot be before startDate/i, 'La fecha de término no puede ser anterior al inicio.'],
  [/Recurring expense not found/i, 'No encontramos ese gasto recurrente.'],
  [/Expense not found/i, 'No encontramos ese gasto.'],
  [/Purchase not found/i, 'No encontramos esa compra.'],
  [/Payment not found/i, 'No encontramos ese pago.'],
  [/Contact not found/i, 'No encontramos ese proveedor.'],
  [/File must be uploaded to the folder|File upload was not confirmed|File not found/i, 'El documento adjunto no se subió bien. Vuelve a adjuntarlo.'],
];

/** Errores de gastos y cuentas por pagar; los de caja se delegan a getCashErrorMessage. */
export function getFinanceErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const api = readApiError(error);
  if (api.status === 0) return 'No hay conexión con el servidor.';
  if (api.code?.startsWith('CASH_')) return getCashErrorMessage(error, fallback);
  const byMessage = BY_MESSAGE.find(([pattern]) => pattern.test(api.message));
  if (byMessage) return byMessage[1];
  if (api.code && BY_CODE[api.code]) return BY_CODE[api.code];
  return fallback;
}
