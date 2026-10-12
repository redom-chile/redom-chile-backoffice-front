import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { getOrderErrorMessage } from '../../../order-list/data-access';
import { formatCurrency } from '../../../order-list/ui';
import { CancelOrderService, OrderDetailDto } from '../../data-access';
import { OrderModalResult } from '../order-modal-result';

@Component({
  selector: 'app-cancel-order-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './cancel-order-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelOrderModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<CancelOrderModalComponent, OrderModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly cancelService = inject(CancelOrderService);
  private readonly businessSettings = inject(BusinessSettingsService);

  readonly order = inject<OrderDetailDto>(MAT_DIALOG_DATA);
  readonly $isLoading = this.cancelService.$isLoading;
  readonly formatCurrency = formatCurrency;
  // Solo con descuento al pedir hay stock que devolver (con descuento al pagar aún no se descontó).
  readonly $returnsStock = computed(() => {
    const inventory = this.businessSettings.$inventory();
    return inventory.inventoryEnabled && inventory.deductStockOnSale && inventory.stockDeductionMoment === 'on_order';
  });

  constructor() {
    effect(() => {
      if (this.cancelService.$success()) {
        this.dialogRef.close('cancelled-order');
      }
    });

    effect(() => {
      const error = this.cancelService.$error();
      if (error) {
        this.toast.show(getOrderErrorMessage(error), 'error');
      }
    });
  }

  handleConfirm() {
    this.cancelService.cancel(this.order.transactionId);
  }

  handleCancel() {
    this.dialogRef.close('dismissed');
  }

  ngOnDestroy(): void {
    this.cancelService.reset();
  }
}
