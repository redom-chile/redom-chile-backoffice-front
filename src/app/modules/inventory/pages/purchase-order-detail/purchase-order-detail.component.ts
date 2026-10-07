import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  IconComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  formatUnitCost,
  isInventoryDisabledError,
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  PurchaseOrdersService,
  PurchaseOrderStatusChange,
  UnitsService,
} from '../../data-access';
import { formatDateTimeFull, formatDocumentDate, resultError, resultValue, toRemoteResult } from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import {
  getPurchaseOrderErrorMessage,
  isOrderEditable,
  isOrderOverdue,
  isOrderReceivable,
  isPurchaseOrderNotFound,
} from './data-access';
import { ReceiveOrderModalComponent, ReceiveOrderModalData, ReceiveOrderModalResult } from './features';
import { PurchaseOrderStatusChipComponent, ReceivedProgressComponent } from './ui';

type OrderAction = 'sent' | 'draft' | 'cancelled';

const STATUS_TOASTS: Record<OrderAction, string> = {
  sent: 'Orden marcada como enviada',
  draft: 'Orden devuelta a borrador',
  cancelled: 'Orden anulada',
};

/** % recibido de la orden: suma de lo recibido sobre lo pedido (en unidad base, tope 100 por línea). */
function receivedPercent(order: PurchaseOrderDto): number {
  const ordered = order.lines.reduce((sum, line) => sum + line.baseQuantity, 0);
  if (ordered <= 0) return 0;
  const received = order.lines.reduce((sum, line) => sum + Math.min(line.receivedBaseQuantity, line.baseQuantity), 0);
  return (received / ordered) * 100;
}

/**
 * Detalle de una orden de compra: cabecera, líneas con lo recibido/pendiente y recepciones (compras creadas).
 * Acciones según el estado: editar, enviar/volver a borrador, recibir y anular.
 */
@Component({
  selector: 'app-purchase-order-detail',
  imports: [
    RouterLink,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    PurchaseOrderStatusChipComponent,
    ReceivedProgressComponent,
  ],
  templateUrl: './purchase-order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderDetailComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #orders = inject(PurchaseOrdersService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);

  protected readonly formatMoney = formatMoney;
  protected readonly formatUnitCost = formatUnitCost;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatDate = formatDocumentDate;
  protected readonly formatDateTime = formatDateTimeFull;
  protected readonly skeletonRows = [1, 2, 3];

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  readonly order = rxResource({
    params: () => (this.$isValidId() && !this.#isDisabledBySettings() ? this.$id() : undefined),
    stream: ({ params }) => this.#orders.get(params).pipe(toRemoteResult()),
  });

  readonly $order = computed(() => resultValue(this.order.value()));
  readonly $error = computed(() => resultError(this.order.value()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));
  readonly $notFound = computed(() => isPurchaseOrderNotFound(this.$error()));
  readonly $errorMessage = computed(() => getPurchaseOrderErrorMessage(this.$error()));

  readonly $busyAction = signal<OrderAction | null>(null);
  // Para recibir se necesitan las unidades (convertir lo pendiente a la unidad de la línea).
  readonly $unitsReady = computed(() => this.#units.$units() !== null || this.#units.$hasError());

  readonly $percent = computed(() => {
    const order = this.$order();
    return order ? receivedPercent(order) : 0;
  });
  readonly $isOverdue = computed(() => {
    const order = this.$order();
    return order ? isOrderOverdue(order) : false;
  });
  readonly $canEdit = computed(() => {
    const order = this.$order();
    return order ? isOrderEditable(order.status) : false;
  });
  readonly $canReceive = computed(() => {
    const order = this.$order();
    return order ? isOrderReceivable(order.status) : false;
  });
  readonly $createdBy = computed(() => {
    const order = this.$order();
    return order?.createdByName || order?.createdBy || '—';
  });

  constructor() {
    this.#units.load();
  }

  linePercent(line: PurchaseOrderLineDto): number {
    return line.baseQuantity > 0 ? (line.receivedBaseQuantity / line.baseQuantity) * 100 : 0;
  }

  /** "2 kg" + "= 2.000 g" cuando la línea está en una subunidad. */
  lineBaseHint(line: PurchaseOrderLineDto): string | null {
    if (!line.baseUnitName || line.unitName === line.baseUnitName) return null;
    return `= ${formatQuantity(line.baseQuantity, line.baseUnitName)}`;
  }

  handleEdit() {
    this.#router.navigate(['/inventory/purchase-orders', this.$id(), 'edit']);
  }

  handleStatus(status: OrderAction) {
    const order = this.$order();
    if (!order || this.$busyAction()) return;
    if (status !== 'cancelled') {
      this.#changeStatus(order.id, status);
      return;
    }
    const partial = order.status === 'partial';
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: `¿Anular la orden #${order.id}?`,
          message: partial
            ? 'Lo ya recibido se mantiene en el stock, pero lo pendiente se cierra y ya no se podrá recibir. No se puede deshacer.'
            : 'La orden quedará anulada y no se podrá editar ni recibir. No se puede deshacer.',
          confirmText: 'Anular orden',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.#changeStatus(order.id, 'cancelled');
      });
  }

  handleReceive() {
    const order = this.$order();
    if (!order || this.$busyAction()) return;
    this.#dialog
      .open<ReceiveOrderModalComponent, ReceiveOrderModalData, ReceiveOrderModalResult>(ReceiveOrderModalComponent, {
        width: '820px',
        maxWidth: '95vw',
        disableClose: true,
        data: { order },
      })
      .afterClosed()
      .subscribe((updated) => {
        if (!updated) return;
        this.order.set({ ok: true, value: updated });
        this.#toast.show(updated.status === 'received' ? 'Orden recibida' : 'Recepción parcial registrada', 'success');
      });
  }

  #changeStatus(id: number, status: PurchaseOrderStatusChange) {
    this.$busyAction.set(status);
    this.#orders
      .changeStatus(id, status)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (order) => {
          this.$busyAction.set(null);
          this.order.set({ ok: true, value: order });
          this.#toast.show(STATUS_TOASTS[status], 'success');
        },
        error: (error) => {
          this.$busyAction.set(null);
          this.#toast.show(getPurchaseOrderErrorMessage(error), 'error');
          // El estado pudo cambiar en otra pestaña: se recarga para mostrar el real.
          this.order.reload();
        },
      });
  }
}
