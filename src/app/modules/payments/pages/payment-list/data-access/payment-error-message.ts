import { HttpStatusCode } from '@angular/common/http';
import { ApiError } from 'src/app/core/utils';
import { isNotEnoughStockError, notEnoughStockMessage } from 'src/app/core/utils/stock-error';

/** Acepta el error normalizado (`readApiError`) o solo el status HTTP. */
export function getPaymentErrorMessage(error: ApiError | HttpStatusCode | undefined): string {
  // El pago que deja el pedido pagado descuenta stock (on_payment) y puede responder 409 por falta de stock.
  if (typeof error === 'object' && isNotEnoughStockError(error)) return notEnoughStockMessage(error);
  const status = typeof error === 'object' ? error.status : error;

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
