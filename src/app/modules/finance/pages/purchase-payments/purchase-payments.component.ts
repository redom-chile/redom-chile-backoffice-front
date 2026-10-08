import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { dueLabel, getFinanceErrorMessage, PayableItemDto, PayablesService } from '../../data-access';
import { formatDay, openPayPayableModal, PayablePaymentsComponent } from '../../features';
import type { PurchasePaymentsState } from '../payables/payables.component';

/** Item que trae la navegación desde Cuentas por pagar (si corresponde a esta compra). */
function stateItem(id: number): PayableItemDto | null {
  const payable = (history.state as PurchasePaymentsState | null)?.payable;
  return payable && payable.type === 'purchase' && payable.id === id ? payable : null;
}

/**
 * Pagos de una compra (documento de inventario). No hay endpoint de detalle en finanzas:
 * el saldo sale de GET /payables?type=purchase; si no aparece ahí, la compra está pagada.
 */
@Component({
  selector: 'app-purchase-payments',
  imports: [RouterLink, ButtonComponent, IconComponent, SkeletonComponent, PayablePaymentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-payments.component.html',
})
export class PurchasePaymentsComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #payables = inject(PayablesService);

  readonly formatCurrency = formatCurrency;
  readonly formatDay = formatDay;
  readonly dueLabel = dueLabel;

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);
  readonly #stateItem = stateItem(this.$id());

  // Deuda abierta de la compra (null = sin saldo pendiente).
  readonly payable = rxResource({
    params: () => (this.$isValidId() ? this.$id() : undefined),
    stream: ({ params }) =>
      this.#payables.list({ type: 'purchase' }).pipe(
        map((data) => data.items.find((item) => item.type === 'purchase' && item.id === params) ?? null),
        toRemoteResult(),
      ),
  });

  readonly payments = rxResource({
    params: () => (this.$isValidId() ? this.$id() : undefined),
    stream: ({ params }) => this.#payables.payments('purchase', params).pipe(toRemoteResult()),
  });

  readonly $isPayableLoaded = computed(() => !!this.payable.value()?.ok);
  readonly $openItem = computed(() => resultValue(this.payable.value()));
  // Encabezado: lo cargado o, mientras carga, lo que llegó por navegación.
  readonly $headerItem = computed(() => (this.$isPayableLoaded() ? (this.$openItem() ?? this.#stateItem) : this.#stateItem));
  readonly $isPaid = computed(() => this.$isPayableLoaded() && !this.$openItem());
  readonly $balance = computed(() => (this.$isPaid() ? 0 : (this.$headerItem()?.balance ?? null)));

  readonly $payments = computed(() => resultValue(this.payments.value()));
  readonly $paymentsError = computed(() => resultError(this.payments.value()));
  readonly $payableError = computed(() => resultError(this.payable.value()));
  readonly $isNotFound = computed(() => !!this.$paymentsError() && readApiError(this.$paymentsError()).status === 404);
  readonly $paymentsErrorMessage = computed(() => getFinanceErrorMessage(this.$paymentsError(), 'No se pudieron cargar los pagos.'));

  pay(item: PayableItemDto) {
    openPayPayableModal(this.#dialog, {
      type: 'purchase',
      id: item.id,
      description: item.description,
      balance: item.balance,
      locationId: item.locationId,
    }).subscribe((result) => {
      if (result) this.reload();
    });
  }

  reload() {
    this.payable.reload();
    this.payments.reload();
  }
}
