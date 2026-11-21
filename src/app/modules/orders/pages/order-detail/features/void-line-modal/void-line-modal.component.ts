import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { readApiError } from 'src/app/core/utils';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { getOrderErrorMessage } from '../../../order-list/data-access';
import { formatCurrency } from '../../../order-list/ui';
import {
  OrderLineDto,
  orderVariationLabel,
  VOID_REASON_LABELS,
  VoidOrderLineResultDto,
  VoidOrderLineService,
  VoidReason,
} from '../../data-access';

export type VoidLineModalData = Readonly<{
  orderId: number;
  line: OrderLineDto;
  // El pedido pasa por cocina: se avisa si ya se está preparando.
  isKitchenOrder: boolean;
}>;

/** Resultado: la anulación hecha, o undefined si se cerró sin anular. */
export type VoidLineModalResult = VoidOrderLineResultDto | undefined;

/** Anular unidades de un producto ya enviado a la cuenta, con su motivo (C46). */
@Component({
  selector: 'app-void-line-modal',
  standalone: true,
  imports: [FormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './void-line-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoidLineModalComponent {
  readonly #dialogRef = inject<MatDialogRef<VoidLineModalComponent, VoidLineModalResult>>(MatDialogRef);
  readonly #service = inject(VoidOrderLineService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #businessSettings = inject(BusinessSettingsService);

  readonly data = inject<VoidLineModalData>(MAT_DIALOG_DATA);
  readonly reasons = VOID_REASON_LABELS;
  readonly formatCurrency = formatCurrency;

  // Lo pagado por productos (dividir la cuenta) no se puede anular.
  readonly maxQuantity = Math.max(0, this.data.line.quantity - (this.data.line.paidQuantity ?? 0));
  readonly $quantity = signal(Math.min(1, this.maxQuantity) || 0);
  readonly $reason = signal<VoidReason | null>(null);
  readonly $note = signal('');
  readonly $saving = signal(false);

  readonly variation = orderVariationLabel(this.data.line.variationName);
  // Precio por unidad con sus modificadores.
  readonly unitTotal = this.data.line.quantity > 0 ? (this.data.line.lineTotal ?? 0) / this.data.line.quantity : 0;
  readonly $amount = computed(() => this.unitTotal * this.$quantity());
  readonly kitchenStatus = this.data.isKitchenOrder ? this.data.line.resLineOrderStatus : null;
  readonly $returnsStock = computed(() => {
    const inventory = this.#businessSettings.$inventory();
    return inventory.inventoryEnabled && inventory.deductStockOnSale && inventory.stockDeductionMoment === 'on_order';
  });
  readonly $canConfirm = computed(
    () =>
      !this.$saving() &&
      this.$quantity() > 0 &&
      this.$quantity() <= this.maxQuantity &&
      this.$reason() !== null &&
      (this.$reason() !== 'other' || this.$note().trim().length > 0),
  );

  change(delta: number) {
    this.$quantity.update((value) => Math.min(this.maxQuantity, Math.max(1, value + delta)));
  }

  handleConfirm() {
    const reason = this.$reason();
    if (!this.$canConfirm() || !reason) return;
    this.$saving.set(true);
    const note = this.$note().trim();
    this.#service
      .voidLine(this.data.orderId, this.data.line.lineId, {
        quantity: this.$quantity(),
        reason,
        ...(note ? { note } : {}),
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => this.#dialogRef.close(result),
        error: (error: unknown) => {
          this.$saving.set(false);
          this.#toast.show(getOrderErrorMessage(readApiError(error)), 'error');
        },
      });
  }

  handleCancel() {
    this.#dialogRef.close(undefined);
  }
}
