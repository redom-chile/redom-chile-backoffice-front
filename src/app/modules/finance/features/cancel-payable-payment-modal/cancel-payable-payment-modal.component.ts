import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ApiErrorCode, readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { CashRetryService } from 'src/app/modules/cash/features/cash-retry';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CancelPayablePaymentResultDto, getFinanceErrorMessage, PayablePaymentDto, PayablesService } from '../../data-access';

export type CancelPayablePaymentData = Readonly<{ payment: PayablePaymentDto; locationId: number | null }>;
/** result null: no se anuló pero el pago cambió (ya anulado, borrado): recargar. */
export type CancelPayablePaymentResult = Readonly<{ result: CancelPayablePaymentResultDto | null }>;

/** Anula un pago de un gasto o compra; el efectivo vuelve a la caja (abierta). */
@Component({
  selector: 'app-cancel-payable-payment-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Anular pago</h2>
      </ng-template>

      <div class="space-y-4 py-2">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
            <app-icon class="h-5 w-5">block</app-icon>
          </div>
          <div>
            <p class="text-foreground text-sm">
              ¿Anular el pago de <span class="font-semibold">{{ formatCurrency(payment.amount) }}</span> en {{ methodLabel.toLowerCase() }}?
            </p>
            <p class="text-muted-foreground mt-1 text-sm">
              El monto vuelve al saldo por pagar.
              @if (payment.cashSessionId) { El efectivo vuelve a la caja (debe estar abierta). }
            </p>
          </div>
        </div>

        <div>
          <label for="cancel-payable-reason" class="text-foreground mb-1 block text-sm font-medium">Motivo *</label>
          <div class="mb-2 flex flex-wrap gap-2">
            @for (option of reasons; track option) {
              <button type="button" class="glass-row rounded-full px-3 py-1 text-xs" (click)="reason.setValue(option)">{{ option }}</button>
            }
          </div>
          <textarea
            id="cancel-payable-reason"
            [formControl]="reason"
            rows="2"
            maxlength="255"
            placeholder="Escribe o elige un motivo"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="reason.invalid && reason.touched"></textarea>
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="grid grid-cols-2 gap-2">
          <app-button type="button" full impact="light" [disabled]="$isSaving()" (buttonClick)="close()">Volver</app-button>
          <app-button type="button" full impact="bold" tone="danger" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="confirm()">
            Anular pago
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class CancelPayablePaymentModalComponent {
  readonly #dialogRef = inject<MatDialogRef<CancelPayablePaymentModalComponent, CancelPayablePaymentResult>>(MatDialogRef);
  readonly #destroyRef = inject(DestroyRef);
  readonly #payables = inject(PayablesService);
  readonly #cashRetry = inject(CashRetryService);
  readonly #toast = inject(ToastService);

  readonly data = inject<CancelPayablePaymentData>(MAT_DIALOG_DATA);
  readonly payment = this.data.payment;
  readonly methodLabel = PAYMENT_METHOD_LABELS[this.payment.method] ?? this.payment.method;
  readonly formatCurrency = formatCurrency;
  readonly reasons = ['Error de digitación', 'Monto incorrecto', 'Pago duplicado', 'Medio de pago incorrecto'];
  readonly $isSaving = signal(false);

  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] });

  confirm() {
    if (this.$isSaving()) return;
    const reason = this.reason.value.trim();
    if (!reason) {
      this.reason.markAsTouched();
      this.#toast.show('Indica el motivo de la anulación', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.#send(reason);
  }

  #send(reason: string) {
    this.#payables
      .cancelPayment(this.payment.id, reason)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.#toast.show(`Pago anulado · saldo ${formatCurrency(result.balance)}`, 'success');
          this.#dialogRef.close({ result });
        },
        error: (error: unknown) => this.#handleError(error, reason),
      });
  }

  #handleError(error: unknown, reason: string) {
    const api = readApiError(error);
    // La caja de origen está cerrada: se abre y se reintenta.
    if (api.code === ApiErrorCode.CASH_SESSION_REQUIRED || api.code === ApiErrorCode.CASH_REGISTER_AMBIGUOUS) {
      this.#cashRetry
        .resolve(api, { locationId: this.data.locationId, purpose: 'Abre la caja para devolver el efectivo: el dinero del pago anulado vuelve a ella.' })
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((registerId) => {
          if (registerId) return this.#send(reason);
          this.$isSaving.set(false);
          if (registerId === undefined) this.#toast.show(getFinanceErrorMessage(error, 'No se pudo anular el pago'), 'error');
        });
      return;
    }
    if (api.status === 409 || api.status === 404) {
      this.#toast.show(getFinanceErrorMessage(error, 'El pago cambió. Revisa nuevamente.'), 'warning');
      this.#dialogRef.close({ result: null });
      return;
    }
    this.$isSaving.set(false);
    this.#toast.show(getFinanceErrorMessage(error, 'No se pudo anular el pago'), 'error');
  }

  close() {
    this.#dialogRef.close();
  }
}

export function openCancelPayablePaymentModal(dialog: MatDialog, data: CancelPayablePaymentData): Observable<CancelPayablePaymentResult | undefined> {
  return dialog
    .open<CancelPayablePaymentModalComponent, CancelPayablePaymentData, CancelPayablePaymentResult>(CancelPayablePaymentModalComponent, {
      width: '440px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
