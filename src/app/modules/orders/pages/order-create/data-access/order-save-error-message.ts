import { HttpStatusCode } from '@angular/common/http';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';
import { isNotEnoughStockError, notEnoughStockMessage } from 'src/app/core/utils/stock-error';
import { getOrderErrorMessage } from '../../order-list/data-access';

// "Product X is not for sale" (400 sin código propio).
const NOT_FOR_SALE = /^Product (.+) is not for sale$/i;

/** La opción elegida ya no está en el producto: hay que recargar la carta y volver a elegirla. */
export function isModifierNotAvailableError(error: ApiError): boolean {
  return error.code === ApiErrorCode.MODIFIER_NOT_AVAILABLE;
}

// ": elige de 1 a 2" cuando el backend informa el rango del grupo.
function packRange(details: Record<string, unknown>): string {
  const min = Number(details['minChoices']);
  const max = Number(details['maxChoices']);
  if (!Number.isFinite(min) || !Number.isFinite(max) || details['minChoices'] === undefined) return '';
  return min === max ? ` (elige ${min})` : ` (elige de ${min} a ${max})`;
}

/** 409 PRODUCT_UNAVAILABLE con reason 'dailySpecialSoldOut' (details.portionsLeft); null si es otro error. */
function dailySpecialSoldOutMessage(error: ApiError, productName?: (productId: number) => string | undefined): string | null {
  if (error.code !== 'PRODUCT_UNAVAILABLE' || error.details['reason'] !== 'dailySpecialSoldOut') return null;
  const name = productName?.(Number(error.details['productId']));
  const left = Number(error.details['portionsLeft']);
  if (Number.isInteger(left) && left > 0)
    return `Plato del día${name ? ` (${name})` : ''}: ${left === 1 ? 'queda 1 porción' : `quedan ${left} porciones`}. Ajusta la cantidad o repón porciones.`;
  return `Plato del día agotado${name ? ` (${name})` : ''}: repón porciones en Carta dinámica.`;
}

/**
 * Mensaje al crear un pedido o agregar productos. POST /orders/:id/lines responde 409 sin
 * código propio (code CONFLICT) cuando la cuenta ya se cerró o se canceló; el 409 por falta de
 * stock (negocio sin stock negativo) se distingue por el mensaje y se revisa antes.
 * `productName` resuelve el nombre del producto del carrito que indica `details.productId`.
 */
export function getOrderSaveErrorMessage(
  error: ApiError,
  adding: boolean,
  productName?: (productId: number) => string | undefined,
): string {
  if (isNotEnoughStockError(error)) return notEnoughStockMessage(error);
  // 409 del plato del día sin porciones (va antes: al agregar, un 409 sin código propio es "cuenta cerrada")
  const special = dailySpecialSoldOutMessage(error, productName);
  if (special) return special;

  const notOpen =
    error.code === ApiErrorCode.ORDER_NOT_OPEN || (adding && error.status === HttpStatusCode.Conflict);
  if (notOpen) return 'La cuenta ya no está abierta: no se le pueden agregar productos.';

  const name = productName?.(Number(error.details['productId']));
  if (error.code === ApiErrorCode.MODIFIER_NOT_AVAILABLE)
    return `Una de las opciones elegidas ya no está disponible para ${name ?? 'un producto'}. Vuelve a elegirlas.`;
  if (error.code === ApiErrorCode.MODIFIER_REPEATED)
    return `Hay una opción repetida en ${name ?? 'un producto'}. Edítalo y vuelve a intentar.`;

  // Packs: elecciones fuera de rango o una opción inactiva/eliminada (400).
  if (error.code === 'PACK_CHOICES_INVALID') {
    const range = packRange(error.details);
    return `Revisa las opciones del pack${name ? ` ${name}` : ''}${range}. Tócalo en el ticket para corregirlas.`;
  }
  if (error.code === 'PRODUCT_UNAVAILABLE')
    return `Una de las opciones del pack${name ? ` ${name}` : ''} ya no está disponible. Vuelve a elegirlas.`;

  const notForSale = error.status === HttpStatusCode.BadRequest ? NOT_FOR_SALE.exec(error.message) : null;
  if (notForSale) return `${notForSale[1]} ya no está a la venta. Quítalo del pedido y vuelve a intentar.`;

  return getOrderErrorMessage(error);
}
