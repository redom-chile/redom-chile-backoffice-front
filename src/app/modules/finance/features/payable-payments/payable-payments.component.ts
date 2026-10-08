import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { IconComponent } from 'src/ui';
import { PayablePaymentDto } from '../../data-access';
import { openCancelPayablePaymentModal } from '../cancel-payable-payment-modal';
import { formatPaidAt } from './payable-format';

/** Pagos de un gasto o compra (incluye anulados) con la acción "Anular". Emite `changed` tras anular. */
@Component({
  selector: 'app-payable-payments',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payable-payments.component.html',
})
export class PayablePaymentsComponent {
  readonly #dialog = inject(MatDialog);

  readonly payments = input.required<readonly PayablePaymentDto[]>();
  // Local de la deuda: para abrir la caja al devolver efectivo.
  readonly locationId = input<number | null>(null);
  readonly canCancel = input(true);
  readonly changed = output<void>();

  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly formatCurrency = formatCurrency;
  readonly formatPaidAt = formatPaidAt;

  readonly $sorted = computed(() => [...this.payments()].sort((a, b) => b.paidAt.localeCompare(a.paidAt)));
  readonly $activeTotal = computed(() => this.payments().reduce((sum, payment) => (payment.cancelled ? sum : sum + payment.amount), 0));

  cancel(payment: PayablePaymentDto) {
    openCancelPayablePaymentModal(this.#dialog, { payment, locationId: this.locationId() }).subscribe((result) => {
      if (result) this.changed.emit();
    });
  }
}
