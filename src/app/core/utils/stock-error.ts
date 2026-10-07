import { HttpStatusCode } from '@angular/common/http';
import { ApiError } from './api-error';

// 409 sin código propio cuando el negocio no permite stock negativo:
// "Not enough stock for: Queso mozzarella, Coca-Cola lata (negative stock is not allowed)".
const NOT_ENOUGH_STOCK = /^Not enough stock for:\s*(.*?)(?:\s*\(negative.*)?$/is;

/** La venta dejaría ingredientes o productos bajo cero (POST /orders, /orders/:id/lines, /payments, PATCH /orders/:id). */
export function isNotEnoughStockError(error: ApiError): boolean {
  return error.status === HttpStatusCode.Conflict && NOT_ENOUGH_STOCK.test(error.message);
}

/** Nombres de los ítems sin stock tal como los envía el backend ("Queso mozzarella, Coca-Cola lata"). */
export function notEnoughStockItems(error: ApiError): string {
  return NOT_ENOUGH_STOCK.exec(error.message)?.[1]?.trim() ?? '';
}

export function notEnoughStockMessage(error: ApiError): string {
  const items = notEnoughStockItems(error);
  return (
    `No hay stock suficiente${items ? ` de ${items}` : ''}. ` +
    'Registra una compra o activa "Permitir stock negativo" en Inventario.'
  );
}
