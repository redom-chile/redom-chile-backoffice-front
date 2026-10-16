import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { GetAllTablesService } from 'src/app/modules/tables/pages/table-list/data-access';
import { getOrderErrorMessage, GetServiceStaffService } from '../../../order-list/data-access';
import { formatCurrency } from '../../../order-list/ui';
import { DiscountType, OrderDetailDto, UpdateOrderDto, UpdateOrderService } from '../../data-access';
import { OrderModalResult } from '../order-modal-result';
import { CustomerDto } from 'src/app/modules/orders/pages/order-create/data-access';
import { CustomerSelectorComponent } from 'src/app/modules/orders/pages/order-create/features/customer-selector';

type DiscountOption = DiscountType | 'none';

@Component({
  selector: 'app-update-order-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, ButtonComponent, ModalCardComponent, SlotDirective, CustomerSelectorComponent],
  templateUrl: './update-order-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateOrderModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<UpdateOrderModalComponent, OrderModalResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly updateService = inject(UpdateOrderService);
  private readonly tablesService = inject(GetAllTablesService);

  readonly order = inject<OrderDetailDto>(MAT_DIALOG_DATA);
  readonly $tables = this.tablesService.$tables;
  readonly $staff = inject(GetServiceStaffService).$staff;
  readonly $isLoading = this.updateService.$isLoading;
  readonly formatCurrency = formatCurrency;

  readonly inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  readonly form = inject(FormBuilder).group({
    resTableId: [this.order.resTableId],
    resWaiterId: [this.order.resWaiterId],
    discountType: [(this.order.discountAmount > 0 ? this.order.discountType : 'none') as DiscountOption | null],
    discountAmount: [this.order.discountAmount, [Validators.min(0)]],
    additionalNotes: [this.order.additionalNotes ?? ''],
    staffNote: [this.order.staffNote ?? ''],
  });

  // El detalle solo trae id y nombre del cliente.
  readonly $customer = signal<CustomerDto | null>(
    this.order.contactId ? { id: this.order.contactId, name: this.order.customerName ?? 'Cliente', mobile: '', email: null } : null,
  );

  readonly $discountType = toSignal(this.form.controls.discountType.valueChanges, {
    initialValue: this.form.controls.discountType.value,
  });
  readonly $maxDiscount = computed(() =>
    this.$discountType() === 'percentage' ? 100 : this.$discountType() === 'fixed' ? this.order.totalBeforeTax : 0,
  );

  constructor() {
    this.tablesService.setParams(this.order.locationId);

    effect(() => {
      const max = this.$maxDiscount();
      const amount = this.form.controls.discountAmount;
      amount.setValidators([Validators.min(0), Validators.max(max)]);
      if (this.$discountType() === 'none') amount.setValue(0, { emitEvent: false });
      amount.updateValueAndValidity({ emitEvent: false });
    });

    effect(() => {
      if (this.updateService.$success()) {
        this.dialogRef.close('updated');
      }
    });

    effect(() => {
      const error = this.updateService.$error();
      if (error) {
        this.toast.show(getOrderErrorMessage(error), 'error');
      }
    });
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show('Revisa el descuento ingresado', 'warning');
      return;
    }
    const changes = this.buildChanges();
    if (Object.keys(changes).length === 1) {
      this.dialogRef.close('dismissed');
      return;
    }
    this.updateService.update(changes);
  }

  handleCancel() {
    this.dialogRef.close('dismissed');
  }

  ngOnDestroy(): void {
    this.updateService.reset();
  }

  // Solo se envían los campos que cambiaron; el backend deja el resto igual.
  private buildChanges(): UpdateOrderDto {
    const value = this.form.getRawValue();
    const order = this.order;
    const originalType: DiscountOption = order.discountAmount > 0 ? (order.discountType ?? 'fixed') : 'none';
    const discountType = (value.discountType ?? 'none') as DiscountOption;
    const discountAmount = discountType === 'none' ? 0 : (value.discountAmount ?? 0);
    const contactId = this.$customer()?.id ?? null;
    const discountChanged = discountType !== originalType || discountAmount !== order.discountAmount;

    return {
      id: order.transactionId,
      ...(value.resTableId !== null && value.resTableId !== order.resTableId && { resTableId: value.resTableId }),
      ...(value.resWaiterId && value.resWaiterId !== order.resWaiterId && { resWaiterId: value.resWaiterId }),
      ...(contactId !== order.contactId && { contactId }),
      ...(discountChanged && {
        discountType: discountType === 'none' ? 'fixed' : discountType,
        discountAmount,
      }),
      ...((value.additionalNotes ?? '') !== (order.additionalNotes ?? '') && {
        additionalNotes: value.additionalNotes ?? '',
      }),
      ...((value.staffNote ?? '') !== (order.staffNote ?? '') && { staffNote: value.staffNote ?? '' }),
    };
  }
}
