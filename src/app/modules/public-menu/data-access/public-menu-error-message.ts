import { readApiError } from 'src/app/core/utils/api-error';
import { ChefPicksErrorReason } from './dtos/menu-design.dto';

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
    case 'MENU_MOVED':
      return 'Esta carta cambió de dirección. Recarga la página.';
    case 'PRODUCT_UNAVAILABLE':
      return 'Un producto del pedido ya no está disponible.';
    case 'ORDER_TOO_LARGE':
      return 'El pedido supera el monto máximo del local.';
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
      return 'Tienes pedidos esperando confirmación. Espera un momento.';
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
    case 'API_KEY_INVALID':
      return 'La llave no existe o fue revocada.';
    case 'API_KEY_ORIGIN_NOT_ALLOWED':
      return 'Este sitio no está en los orígenes permitidos de la llave.';
    case 'API_KEY_FORBIDDEN':
      return 'La llave no corresponde a este negocio.';
    case 'SECRET_KEY_REQUIRED':
      return 'Esta consulta necesita la llave secreta, desde un servidor.';
    case 'AI_TRANSLATIONS_QUOTA_EXCEEDED':
      return 'Usaste las traducciones con IA de este mes.';
    case 'AI_TRANSLATIONS_UNAVAILABLE':
      return 'La IA no está disponible ahora, intenta más tarde.';
    case 'MENU_DESIGN_INVALID':
      return menuDesignFieldMessage(typeof api.details['field'] === 'string' ? api.details['field'] : '');
    case 'CHEF_PICKS_INVALID':
      return CHEF_PICKS_REASON_MESSAGES[api.details['reason'] as ChefPicksErrorReason] ?? 'Revisa las recomendaciones del chef.';
    case 'REORDER_IDS_MISMATCH':
      return 'La lista cambió mientras ordenabas. Recarga e inténtalo de nuevo.';
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

/** Texto para el campo de details.field de 400 MENU_DESIGN_INVALID. */
export function menuDesignFieldMessage(field: string): string {
  if (field === 'template') return 'Elige una de las plantillas disponibles.';
  if (field === 'font') return 'Elige una de las tipografías disponibles.';
  if (field === 'cardStyle') return 'Elige una forma de tarjeta válida.';
  if (field.startsWith('categoryStyles')) return 'Una categoría tiene una forma de tarjeta no válida.';
  if (field.startsWith('accessibility')) return 'Revisa las opciones de accesibilidad.';
  if (field === 'announcement.text') return 'El anuncio debe tener entre 1 y 160 caracteres.';
  if (field === 'announcement.startsAt') return 'La fecha de inicio del anuncio no es válida.';
  if (field === 'announcement.endsAt') return 'El término del anuncio debe ser una fecha válida y posterior al inicio.';
  if (field === 'story') return 'La historia puede tener hasta 1000 caracteres.';
  return 'Revisa los datos del diseño de la carta.';
}

export const CHEF_PICKS_REASON_MESSAGES: Readonly<Record<ChefPicksErrorReason, string>> = {
  too_many: 'Puedes recomendar hasta 12 productos.',
  duplicated: 'Hay un producto repetido en las recomendaciones.',
  not_found: 'Uno de los productos ya no existe. Quítalo de la lista.',
  not_for_sale: 'Uno de los productos no está a la venta. Quítalo de la lista.',
  schedule: 'Revisa el horario: cada tramo necesita días y horas de inicio y término distintas.',
};

/** details de 400 MENU_DESIGN_INVALID (null si es otro error). */
export function menuDesignErrorField(error: unknown): string | null {
  const api = readApiError(error);
  if (api.code !== 'MENU_DESIGN_INVALID') return null;
  return typeof api.details['field'] === 'string' ? api.details['field'] : '';
}

/** details de 400 CHEF_PICKS_INVALID (null si es otro error). */
export function chefPicksError(error: unknown): Readonly<{ reason: ChefPicksErrorReason | null; productIds: number[] }> | null {
  const api = readApiError(error);
  if (api.code !== 'CHEF_PICKS_INVALID') return null;
  const reason = typeof api.details['reason'] === 'string' ? (api.details['reason'] as ChefPicksErrorReason) : null;
  const ids = Array.isArray(api.details['productIds']) ? api.details['productIds'] : [];
  return { reason, productIds: ids.map(Number).filter(Number.isFinite) };
}
