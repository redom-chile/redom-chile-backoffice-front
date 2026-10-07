import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';

/** "+$800" o "Sin costo". */
export function formatModifierPrice(price: number): string {
  return price > 0 ? `+${formatCurrency(price)}` : 'Sin costo';
}
