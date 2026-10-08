import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { printHtml } from 'src/app/shared/utils/printing/browser-print';
import { ButtonComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { getFinanceErrorMessage, TIP_MODE_LABELS, TipPayoutDto, TipsService } from '../../data-access';
import { formatPaidAt } from '../../features/payable-payments/payable-format';
import { tipPeriodLabel, tipReceiptHtml } from '../../features/tip-receipt-print';
import type { TipPayoutCreatedState } from '../tip-payout-new/tip-payout-new.component';
import { openCancelTipPayoutModal } from './cancel-tip-payout-modal.component';

/** Detalle de una liquidación de propinas: datos, reparto por persona, comprobante y anulación. */
@Component({
  selector: 'app-tip-payout-detail',
  imports: [RouterLink, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tip-payout-detail.component.html',
})
export class TipPayoutDetailComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #tips = inject(TipsService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);

  readonly formatCurrency = formatCurrency;
  readonly formatPaidAt = formatPaidAt;
  readonly periodLabel = tipPeriodLabel;
  readonly modeLabels = TIP_MODE_LABELS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);

  // Recién creada: se ofrece imprimir el comprobante.
  readonly $justCreated = signal(!!(history.state as TipPayoutCreatedState | null)?.tipPayoutCreated);
  readonly $isPrinting = signal(false);

  readonly payout = rxResource({
    params: () => (this.$isValidId() ? this.$id() : undefined),
    stream: ({ params }) => this.#tips.payout(params).pipe(toRemoteResult()),
  });
  readonly $payout = computed(() => resultValue(this.payout.value()));
  readonly $error = computed(() => resultError(this.payout.value()));
  readonly $isNotFound = computed(() => !!this.$error() && readApiError(this.$error()).status === 404);
  readonly $errorMessage = computed(() => getFinanceErrorMessage(this.$error(), 'No se pudo cargar la liquidación.'));
  readonly $showPoints = computed(() => this.$payout()?.mode === 'points');

  async print(payout: TipPayoutDto) {
    if (this.$isPrinting()) return;
    this.$isPrinting.set(true);
    try {
      await printHtml(tipReceiptHtml(payout, this.#settings.$settings()?.name), 80);
      this.$justCreated.set(false);
    } catch {
      this.#toast.show('No se pudo imprimir el comprobante', 'error');
    } finally {
      this.$isPrinting.set(false);
    }
  }

  cancelPayout(payout: TipPayoutDto) {
    openCancelTipPayoutModal(this.#dialog, payout).subscribe((result) => {
      if (!result) return;
      this.$justCreated.set(false);
      if (result.payout) this.payout.set({ ok: true, value: result.payout });
      else this.payout.reload();
    });
  }
}
