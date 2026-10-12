import { PurchaseOrderStatus, todayIsoDate } from '../../../data-access';

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  partial: 'Parcial',
  received: 'Recibida',
  cancelled: 'Anulada',
};

export const PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = ['draft', 'sent', 'partial', 'received', 'cancelled'];

/** Solo borrador y enviada se pueden editar (después de recibir algo ya no). */
export function isOrderEditable(status: PurchaseOrderStatus): boolean {
  return status === 'draft' || status === 'sent';
}

export function isOrderReceivable(status: PurchaseOrderStatus): boolean {
  return status === 'draft' || status === 'sent' || status === 'partial';
}

/** Atrasada: la fecha esperada ya pasó y todavía falta recibir. */
export function isOrderOverdue(order: Readonly<{ status: PurchaseOrderStatus; expectedDate: string | null }>): boolean {
  if (!order.expectedDate || (order.status !== 'sent' && order.status !== 'partial')) return false;
  return order.expectedDate.slice(0, 10) < todayIsoDate();
}

/** "Orden #12 · OC-001" para títulos. */
export function purchaseOrderTitle(order: Readonly<{ id: number; referenceNo: string | null }>): string {
  return order.referenceNo ? `Orden #${order.id} · ${order.referenceNo}` : `Orden #${order.id}`;
}
