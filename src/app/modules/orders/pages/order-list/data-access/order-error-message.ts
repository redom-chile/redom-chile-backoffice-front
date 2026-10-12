import { HttpStatusCode } from '@angular/common/http';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';
import { isNotEnoughStockError, notEnoughStockMessage } from 'src/app/core/utils/stock-error';

// Mensajes por código de negocio del backend (tienen prioridad sobre el status HTTP).
const ORDER_ERROR_BY_CODE: Partial<Record<string, string>> = {
  [ApiErrorCode.ORDER_HAS_PAYMENTS]: 'El pedido tiene pagos registrados. Anúlalos antes de cancelarlo.',
  [ApiErrorCode.ORDER_NOT_OPEN]: 'El pedido ya no está abierto.',
  [ApiErrorCode.TABLE_BLOCKED]: 'La mesa está bloqueada y no puede recibir pedidos.',
};

/** Acepta el error normalizado (`readApiError`) o, por compatibilidad, solo el status HTTP. */
export function getOrderErrorMessage(error: ApiError | HttpStatusCode | undefined): string {
  // PATCH /orders/:id (p. ej. un descuento que deja el pedido pagado) puede fallar por falta de stock.
  if (typeof error === 'object' && isNotEnoughStockError(error)) return notEnoughStockMessage(error);
  const { status, code } = typeof error === 'object' ? error : { status: error, code: null };
  const byCode = code ? ORDER_ERROR_BY_CODE[code] : undefined;
  if (byCode) return byCode;

  switch (status) {
    case HttpStatusCode.BadRequest:
      return 'Los datos ingresados no son válidos.';
    case HttpStatusCode.Forbidden:
      return 'No tienes permiso para esta acción.';
    case HttpStatusCode.NotFound:
      return 'El pedido no existe.';
    case HttpStatusCode.Conflict:
      return 'No se puede realizar la acción en el estado actual del pedido.';
    default:
      return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}
