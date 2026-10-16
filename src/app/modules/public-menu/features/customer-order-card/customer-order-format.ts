import {
  CustomerOrderChannel,
  CustomerOrderDto,
  CustomerOrderStatus,
  OnlinePaymentMethod,
  OrderFulfillment,
  OrderPaymentStatus,
} from 'src/app/modules/public-menu/data-access';

export const CUSTOMER_ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado por el cliente',
};

export const CHANNEL_LABELS: Record<CustomerOrderChannel, string> = { table: 'Mesa', pickup: 'Retiro', delivery: 'Delivery' };
export const CHANNEL_ICONS: Record<CustomerOrderChannel, string> = { table: 'table_restaurant', pickup: 'storefront', delivery: 'delivery_dining' };

export const PAYMENT_METHOD_LABELS: Record<OnlinePaymentMethod, string> = {
  transfer_receipt: 'Transferencia',
  cash_on_pickup: 'Efectivo al retirar',
  card_on_pickup: 'Tarjeta al retirar',
  cash_on_delivery: 'Efectivo al recibir',
  card_on_delivery: 'Tarjeta al recibir',
};

export const PAYMENT_STATUS: Record<OrderPaymentStatus, { label: string; classes: string }> = {
  not_required: { label: 'Paga al recibir', classes: 'bg-muted/40 text-muted-foreground' },
  awaiting_receipt: { label: 'Esperando comprobante', classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  to_verify: { label: 'Comprobante por revisar', classes: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  paid: { label: 'Pagado', classes: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  rejected: { label: 'Pago rechazado', classes: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};

export const FULFILLMENT_LABELS: Record<OrderFulfillment, string> = { ready: 'Listo', on_the_way: 'En camino', delivered: 'Entregado' };
/** Texto del botón para avanzar a cada paso. */
export const FULFILLMENT_ACTIONS: Record<OrderFulfillment, string> = {
  ready: 'Marcar listo',
  on_the_way: 'Salió a reparto',
  delivered: 'Marcar entregado',
};

export const channelOf = (order: Pick<CustomerOrderDto, 'channel'>): CustomerOrderChannel => order.channel ?? 'table';
export const isOnline = (order: Pick<CustomerOrderDto, 'channel'>) => channelOf(order) !== 'table';

/** Mesa: su nombre; retiro y delivery: el canal y el cliente. */
export function tableLabel(order: CustomerOrderDto): string {
  const channel = channelOf(order);
  if (channel === 'table') return order.table?.name ?? 'Sin mesa';
  return order.customerName ? `${CHANNEL_LABELS[channel]} · ${order.customerName}` : CHANNEL_LABELS[channel];
}

/** Pasos que quedan, solo hacia adelante (retiro: listo → entregado; delivery: listo → en camino → entregado). */
export function nextFulfillmentSteps(order: CustomerOrderDto): OrderFulfillment[] {
  const channel = channelOf(order);
  if (channel === 'table' || order.status !== 'accepted') return [];
  const steps: OrderFulfillment[] = channel === 'delivery' ? ['ready', 'on_the_way', 'delivered'] : ['ready', 'delivered'];
  return steps.slice(order.fulfillment ? steps.indexOf(order.fulfillment) + 1 : 0);
}

/** Aceptado y aún sin entregar: sigue en curso. */
export const isInProgress = (order: CustomerOrderDto) => isOnline(order) && order.status === 'accepted' && order.fulfillment !== 'delivered';

/** wa.me con el número en dígitos; un celular chileno de 9 dígitos se completa con 56. */
export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits.length === 9 && digits.startsWith('9') ? `56${digits}` : digits}`;
}

/** "recién", "hace 3 min", "hace 1 h 5 min". */
export function formatElapsed(from: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `hace ${hours} h ${rest} min` : `hace ${hours} h`;
}

const DATE_TIME = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "14 oct, 13:05". */
export const formatOrderDate = (value: string | null) => (value ? DATE_TIME.format(new Date(value)) : '');

/** "mié 15 oct, 13:30" en la zona horaria del negocio. */
export function formatScheduled(value: string, timeZone: string | null): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat('es-CL', { ...options, timeZone: timeZone || undefined }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('es-CL', options).format(new Date(value));
  }
}

/** Las URL firmadas pueden no traer extensión: sin ".pdf" se intenta como imagen. */
export const isPdfUrl = (url: string) => /\.pdf(?:$|[?#])/i.test(url);
