import { HttpStatusCode } from '@angular/common/http';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';
import { getOrderErrorMessage } from '../../order-list/data-access';

// "Product X is not for sale" (400 sin código propio).
const NOT_FOR_SALE = /^Product (.+) is not for sale$/i;

/** La opción elegida ya no está en el producto: hay que recargar la carta y volver a elegirla. */
export function isModifierNotAvailableError(error: ApiError): boolean {
  return error.code === ApiErrorCode.MODIFIER_NOT_AVAILABLE;
}

/**
 * Mensaje al crear un pedido o agregar productos. POST /orders/:id/lines responde 409 sin
 * código propio (code CONFLICT) cuando la cuenta ya se cerró o se canceló.
 * `productName` resuelve el nombre del producto del carrito que indica `details.productId`.
 */
export function getOrderSaveErrorMessage(
  error: ApiError,
  adding: boolean,
  productName?: (productId: number) => string | undefined,
): string {
  const notOpen =
    error.code === ApiErrorCode.ORDER_NOT_OPEN || (adding && error.status === HttpStatusCode.Conflict);
  if (notOpen) return 'La cuenta ya no está abierta: no se le pueden agregar productos.';

  const name = productName?.(Number(error.details['productId']));
  if (error.code === ApiErrorCode.MODIFIER_NOT_AVAILABLE)
    return `Una de las opciones elegidas ya no está disponible para ${name ?? 'un producto'}. Vuelve a elegirlas.`;
  if (error.code === ApiErrorCode.MODIFIER_REPEATED)
    return `Hay una opción repetida en ${name ?? 'un producto'}. Edítalo y vuelve a intentar.`;

  const notForSale = error.status === HttpStatusCode.BadRequest ? NOT_FOR_SALE.exec(error.message) : null;
  if (notForSale) return `${notForSale[1]} ya no está a la venta. Quítalo del pedido y vuelve a intentar.`;

  return getOrderErrorMessage(error);
}
