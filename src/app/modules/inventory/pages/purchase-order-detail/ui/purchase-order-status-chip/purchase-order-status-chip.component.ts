import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PurchaseOrderStatus } from '../../../../data-access';
import { PURCHASE_ORDER_STATUS_LABELS } from '../../data-access';

const STATUS_CLASSES: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  sent: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  partial: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  received: 'bg-green-500/15 text-green-700 dark:text-green-300',
  cancelled: 'bg-red-500/15 text-red-700 line-through dark:text-red-300',
};

/** Chip de estado de una orden de compra. */
@Component({
  selector: 'app-purchase-order-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="$classes()">{{ $label() }}</span>`,
})
export class PurchaseOrderStatusChipComponent {
  readonly status = input.required<PurchaseOrderStatus>();

  readonly $label = computed(() => PURCHASE_ORDER_STATUS_LABELS[this.status()] ?? this.status());
  readonly $classes = computed(() => STATUS_CLASSES[this.status()] ?? STATUS_CLASSES.draft);
}
