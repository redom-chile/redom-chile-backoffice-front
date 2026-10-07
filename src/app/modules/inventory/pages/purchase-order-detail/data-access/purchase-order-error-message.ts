import { readApiError } from 'src/app/core/utils/api-error';
import { getInventoryErrorMessage } from '../../../data-access';

// Estado en minúscula para armar frases ("una orden recibida").
const STATUS_TEXT: Record<string, string> = {
  draft: 'en borrador',
  sent: 'enviada',
  partial: 'recibida parcialmente',
  received: 'recibida',
  cancelled: 'anulada',
};

const TARGET_TEXT: Record<string, string> = {
  draft: 'borrador',
  sent: 'enviada',
  cancelled: 'anulada',
};

const statusText = (status: string) => STATUS_TEXT[status] ?? status;

/** El backend aún no envía códigos para órdenes de compra: se reconoce el mensaje en inglés. */
const TRANSLATIONS: ReadonlyArray<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/An item is repeated in the order/i, () => 'Hay un ítem repetido en la orden: suma sus cantidades en una sola línea.'],
  [/A (\w+) purchase order cannot be modified/i, (m) => `No se puede editar una orden ${statusText(m[1])}.`],
  [
    /A (\w+) purchase order cannot change to (\w+)/i,
    (m) => `Una orden ${statusText(m[1])} no puede pasar a ${TARGET_TEXT[m[2]] ?? m[2]}.`,
  ],
  [/A (\w+) purchase order cannot be received/i, (m) => `No se puede recibir una orden ${statusText(m[1])}.`],
  [/A line of the order is repeated/i, () => 'Hay una línea repetida en la recepción.'],
  [/Lines not found in the order/i, () => 'Algunas líneas ya no están en la orden. Recarga la página.'],
  [/Purchase order not found/i, () => 'La orden de compra no existe o fue eliminada.'],
  [/Contact not found/i, () => 'El proveedor elegido ya no existe. Elige otro.'],
];

/** Mensaje en español para errores de órdenes de compra; el resto lo traduce getInventoryErrorMessage. */
export function getPurchaseOrderErrorMessage(error: unknown, fallback?: string): string {
  const apiError = readApiError(error);
  if (apiError.status !== 0 && apiError.status !== 403 && apiError.message) {
    for (const [pattern, translate] of TRANSLATIONS) {
      const match = apiError.message.match(pattern);
      if (match) return translate(match);
    }
  }
  return getInventoryErrorMessage(error, fallback);
}

/** 404 al cargar: la orden no existe (o es de otro negocio). */
export function isPurchaseOrderNotFound(error: unknown): boolean {
  return readApiError(error).status === 404;
}
