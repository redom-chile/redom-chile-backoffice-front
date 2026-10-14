import { CustomerOrderDto, CustomerOrderStatus } from 'src/app/modules/public-menu/data-access';

export const CUSTOMER_ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado por el cliente',
};

export const tableLabel = (order: CustomerOrderDto) => order.table?.name ?? 'Sin mesa';

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
