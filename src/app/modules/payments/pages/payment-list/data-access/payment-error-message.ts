import { HttpStatusCode } from '@angular/common/http';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';
import { isNotEnoughStockError, notEnoughStockMessage } from 'src/app/core/utils/stock-error';

const CASH_CODES: readonly string[] = [
  ApiErrorCode.CASH_MANAGEMENT_DISABLED,
  ApiErrorCode.CASH_SESSION_REQUIRED,
  ApiErrorCode.CASH_SESSION_ALREADY_OPEN,
  ApiErrorCode.CASH_SESSION_CLOSED,
  ApiErrorCode.CASH_REGISTER_AMBIGUOUS,
];
const CASH_MESSAGES: ReadonlyArray<[RegExp, string]> = [
  [/belongs to another location/i, 'La caja de este equipo es de otro local que el pedido. Cambia la caja en el POS.'],
  [/cash register is inactive/i, 'La caja de este equipo está desactivada. Elige otra en el POS.'],
  [/Cash register not found/i, 'No encontramos la caja de este equipo. Elige otra en el POS.'],
];

/** Errores de caja al cobrar o anular (módulo de caja activo). */
function cashPaymentMessage(error: ApiError): string | null {
  if (error.code === ApiErrorCode.CASH_SESSION_REQUIRED) return 'La caja está cerrada. Ábrela para continuar.';
  if (error.code === ApiErrorCode.CASH_REGISTER_AMBIGUOUS) return 'Hay varias cajas abiertas en este local: elige con cuál cobrar.';
  if (error.code === ApiErrorCode.CASH_MANAGEMENT_DISABLED) return 'La caja no está activada en este negocio.';
  if (error.code && CASH_CODES.includes(error.code)) return 'No se pudo completar la operación de caja.';
  return CASH_MESSAGES.find(([pattern]) => pattern.test(error.message))?.[1] ?? null;
}

/** Acepta el error normalizado (`readApiError`) o solo el status HTTP. */
export function getPaymentErrorMessage(error: ApiError | HttpStatusCode | undefined): string {
  // El pago que deja el pedido pagado descuenta stock (on_payment) y puede responder 409 por falta de stock.
  if (typeof error === 'object' && isNotEnoughStockError(error)) return notEnoughStockMessage(error);
  const cash = typeof error === 'object' ? cashPaymentMessage(error) : null;
  if (cash) return cash;
  const status = typeof error === 'object' ? error.status : error;

  // Pago por productos (dividir la cuenta): la cuenta se recarga para corregir la selección.
  switch (typeof error === 'object' ? error.code : null) {
    case ApiErrorCode.LINE_ALREADY_PAID:
      return 'Alguno de los productos ya fue pagado. Se actualizó la cuenta: revisa la selección.';
    case ApiErrorCode.INVALID_PAYMENT_LINE:
      return 'Uno de los productos seleccionados no se puede pagar así. Se actualizó la cuenta: revisa la selección.';
    case ApiErrorCode.PAYMENT_AMOUNT_MISMATCH:
      return 'El monto no coincide con el de los productos seleccionados. Intenta nuevamente.';
  }

  switch (status) {
    case HttpStatusCode.BadRequest:
      return 'Revisa los montos: el pago no puede superar el saldo y el efectivo debe cubrir el monto más la propina.';
    case HttpStatusCode.Forbidden:
      return 'No tienes permiso para esta acción.';
    case HttpStatusCode.NotFound:
      return 'El pedido o el pago no existen.';
    case HttpStatusCode.Conflict:
      return 'El pedido ya no está abierto o el pago ya fue anulado.';
    default:
      return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}
