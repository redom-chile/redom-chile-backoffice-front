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
    case 'TABLE_REQUESTS_DISABLED':
      return 'Esta mesa no puede llamar al mesero desde la carta.';
    case 'BOOKINGS_DISABLED':
      return 'Este local no recibe reservas por aquí.';
    case 'BOOKING_INVALID_DATES':
      return 'Reserva entre 30 minutos y 60 días antes.';
    case 'BOOKING_OUTSIDE_HOURS':
      return 'El local está cerrado a esa hora.';
    case 'BOOKING_CONTACT_OVERLAP':
      return 'Ya tienes una reserva a esa hora.';
    case 'FEEDBACK_NOT_ALLOWED':
      return 'Podrás opinar cuando recibas tu pedido.';
    case 'FEEDBACK_ALREADY_SENT':
      return 'Ya enviaste tu opinión. ¡Gracias!';
    case 'PAYMENT_METHOD_NOT_ACCEPTED':
      return 'Elige otro método de pago.';
    case 'ORDER_SCHEDULE_INVALID':
      return 'Elige una hora dentro del plazo permitido.';
    case 'OUTSIDE_DELIVERY_AREA':
      return 'No repartimos a esa dirección.';
    case 'BELOW_MINIMUM_ORDER':
      return 'El pedido no alcanza el mínimo de tu zona.';
    case 'RECEIPT_NOT_ALLOWED':
      return 'Este pedido ya no espera un comprobante.';
    case 'RECEIPT_NOT_VERIFIED':
      return 'Primero hay que confirmar el pago de la transferencia.';
    case 'FULFILLMENT_INVALID':
      return 'Ese paso no corresponde al estado del pedido.';
    case 'WEBHOOK_URL_INVALID':
      return 'La URL debe ser https y pública.';
    case 'AI_TRANSLATIONS_QUOTA_EXCEEDED':
      return 'Usaste las traducciones con IA de este mes.';
    case 'AI_TRANSLATIONS_UNAVAILABLE':
      return 'La IA no está disponible ahora, intenta más tarde.';
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
