import { HttpStatusCode } from '@angular/common/http';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';
import { isNotEnoughStockError, notEnoughStockMessage } from 'src/app/core/utils/stock-error';

/** Acepta el error normalizado (`readApiError`) o solo el status HTTP. */
export function getPaymentErrorMessage(error: ApiError | HttpStatusCode | undefined): string {
  // El pago que deja el pedido pagado descuenta stock (on_payment) y puede responder 409 por falta de stock.
  if (typeof error === 'object' && isNotEnoughStockError(error)) return notEnoughStockMessage(error);
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
