import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ApiErrorCode } from 'src/app/core/utils';
import { openCashSessionModal } from 'src/app/modules/cash/features/open-session-modal';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  IconComponent,
  ModalCardComponent,
  SlotDirective,
  ToastService,
} from 'src/ui';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { CancelPaymentService, getPaymentErrorMessage, PaymentDto, tipPayoutIdOf } from '../../data-access';
import { paymentMethodLabel } from '../../ui';

export type VoidPaymentResult = 'voided' | 'dismissed';

@Component({
  selector: 'app-void-payment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './void-payment-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoidPaymentModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<VoidPaymentModalComponent, VoidPaymentResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly cancelService = inject(CancelPaymentService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly payment = inject<PaymentDto>(MAT_DIALOG_DATA);
  readonly $isLoading = this.cancelService.$isLoading;
  readonly formatCurrency = formatCurrency;
  readonly methodLabel = paymentMethodLabel;
  readonly reasons = ['Error de digitación', 'Método de pago incorrecto', 'Cliente cambió la forma de pago', 'Pago duplicado'];

  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] });

  constructor() {
    effect(() => {
      if (this.cancelService.$success()) this.dialogRef.close('voided');
    });
    effect(() => {
      const error = this.cancelService.$error();
      if (!error) return;
      // Pago en efectivo con la caja cerrada: hay que abrirla para devolver el dinero.
      if (error.code === ApiErrorCode.CASH_SESSION_REQUIRED) {
        const registerId = Number(error.details['registerId']);
        untracked(() => this.openCashAndRetry(Number.isFinite(registerId) && registerId > 0 ? registerId : null));
        return;
      }
      // La propina ya se pagó al equipo: primero hay que anular esa liquidación.
      const payoutId = tipPayoutIdOf(error);
      if (payoutId) {
        untracked(() => this.offerTipPayout(payoutId, getPaymentErrorMessage(error)));
        return;
      }
      this.toast.show(getPaymentErrorMessage(error), 'error');
    });
  }

  handleConfirm() {
    const reason = this.reason.value.trim();
    if (!reason) {
      this.reason.markAsTouched();
      this.toast.show('Indica el motivo de la anulación', 'warning');
      return;
    }
    this.cancelService.cancel({ id: this.payment.id, reason });
  }

  private openCashAndRetry(registerId: number | null) {
    this.toast.show('Abre la caja para devolver el efectivo', 'warning');
    openCashSessionModal(this.dialog, {
      registerId,
      message: 'Para anular un pago en efectivo la caja debe estar abierta: el dinero sale de ella.',
    }).subscribe((opened) => {
      if (opened) this.handleConfirm();
    });
  }

  private offerTipPayout(payoutId: number, message: string) {
    this.toast.show(message, 'warning');
    this.dialogRef.close('dismissed');
    this.dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Propina ya liquidada',
          message: `Para anular este pago, primero anula la liquidación de propinas #${payoutId}.`,
          confirmText: `Ver liquidación #${payoutId}`,
          cancelText: 'Volver',
        },
      })
      .afterClosed()
      .subscribe((go) => {
        if (go) this.router.navigate(['/finance/tips/payouts', payoutId]);
      });
  }

  handleCancel() {
    this.dialogRef.close('dismissed');
  }

  ngOnDestroy(): void {
    this.cancelService.reset();
  }
}
