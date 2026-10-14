import { readApiError } from 'src/app/core/utils/api-error';

/** Errores de la carta pública y su administración. */
export function getPublicMenuErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const api = readApiError(error);
  if (api.status === 0) return 'No hay conexión con el servidor.';
  switch (api.code) {
    case 'SLUG_INVALID':
      return 'Usa de 3 a 60 letras minúsculas, números o guiones.';
    case 'SLUG_RESERVED':
      return 'Esa dirección está reservada, elige otra.';
    case 'SLUG_TAKEN':
      return 'Ya está en uso.';
    case 'MENU_NOT_FOUND':
      return 'Esta carta no está disponible.';
    case 'PRODUCT_NOT_PACK':
      return 'Cambia el tipo del producto a Pack para armar su contenido.';
    case 'ORDERING_DISABLED':
      return 'Este local no está recibiendo pedidos desde la mesa.';
    case 'LOCATION_CLOSED':
      return 'El local está cerrado.';
    case 'TABLE_BLOCKED':
      return 'Esta mesa no está disponible. Llama al mesero.';
    case 'PACK_CHOICES_INVALID':
      return 'Revisa las opciones del pack.';
    case 'TOO_MANY_PENDING_ORDERS':
      return 'Tu mesa tiene pedidos esperando confirmación. Espera un momento.';
    case 'CUSTOMER_ORDER_NOT_PENDING':
      return 'Este pedido ya fue resuelto.';
    case 'MODIFIER_NOT_AVAILABLE':
      return 'Una de las opciones elegidas ya no está disponible.';
    case 'MODIFIER_REPEATED':
      return 'Hay una opción repetida en el pedido.';
    case 'RATE_LIMITED':
      return 'Demasiadas solicitudes, intenta en un minuto.';
  }
  return fallback;
}

/** Motivo de slug-availability en palabras. */
export const SLUG_REASON_LABELS = {
  invalid: 'Solo minúsculas, números y guiones (3 a 60).',
  reserved: 'Palabra reservada.',
  taken: 'Ya está en uso.',
} as const;
