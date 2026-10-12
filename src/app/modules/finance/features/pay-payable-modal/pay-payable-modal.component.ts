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
import {
  CreatePayablePaymentDto,
  getFinanceErrorMessage,
  PAYABLE_TYPE_LABELS,
  PayablePaymentResultDto,
  PayablesService,
  PayableType,
  PaymentMethod,
} from '../../data-access';

export type PayPayableData = Readonly<{
  type: PayableType;
  id: number;
  description: string;
  balance: number;
  locationId: number | null;
}>;

/** payment null: no se registró pero la deuda cambió (ya pagada, anulada): recargar. */
export type PayPayableResult = Readonly<{ payment: PayablePaymentResultDto | null }>;

const METHODS: readonly PaymentMethod[] = ['cash', 'transfer', 'debit', 'credit', 'other'];
// Tolerancia para montos con decimales.
const EPSILON = 0.005;

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Registra un pago (total o parcial) de un gasto o compra. El efectivo sale de la caja abierta del local. */
@Component({
  selector: 'app-pay-payable-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './pay-payable-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayPayableModalComponent {
  readonly #dialogRef = inject<MatDialogRef<PayPayableModalComponent, PayPayableResult>>(MatDialogRef);
  readonly #destroyRef = inject(DestroyRef);
  readonly #payables = inject(PayablesService);
  readonly #cashRetry = inject(CashRetryService);
  readonly #toast = inject(ToastService);

  readonly data = inject<PayPayableData>(MAT_DIALOG_DATA);
  readonly methods = METHODS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly typeLabel = PAYABLE_TYPE_LABELS[this.data.type];
  readonly formatCurrency = formatCurrency;

  readonly $balance = signal(this.data.balance);
  readonly $isSaving = signal(false);
  readonly $method = signal<PaymentMethod>('transfer');
  readonly #initialPaidAt = toLocalInput(new Date());
  readonly maxPaidAt = toLocalInput(new Date(Date.now() + 60_000));

  readonly amount = new FormControl<number | null>(this.data.balance, [Validators.required]);
  readonly paidAt = new FormControl(this.#initialPaidAt, { nonNullable: true, validators: [Validators.required] });
  readonly reference = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] });
  readonly note = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] });

  setFullBalance() {
    this.amount.setValue(this.$balance());
  }

  confirm() {
    if (this.$isSaving()) return;
    const amount = Number(this.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.amount.markAsTouched();
      this.#toast.show('Ingresa un monto mayor a cero', 'warning');
      return;
    }
    if (amount > this.$balance() + EPSILON) {
      this.amount.markAsTouched();
      this.#toast.show(`El monto no puede superar el saldo (${formatCurrency(this.$balance())})`, 'warning');
      return;
    }
    const paidAt = this.paidAt.value;
    const paidDate = new Date(paidAt);
    if (!paidAt || Number.isNaN(paidDate.getTime())) {
      this.#toast.show('Indica la fecha del pago', 'warning');
      return;
    }
    if (paidDate.getTime() > Date.now() + 5 * 60_000) {
      this.#toast.show('La fecha del pago no puede ser futura', 'warning');
      return;
    }
    const method = this.$method();
    const reference = this.reference.value.trim();
    const note = this.note.value.trim();
    const dto: CreatePayablePaymentDto = {
      method,
      amount,
      // Sin cambiar la fecha, el backend usa "ahora".
      ...(paidAt !== this.#initialPaidAt ? { paidAt: paidDate.toISOString() } : {}),
      ...(reference ? { reference } : {}),
      ...(note ? { note } : {}),
    };
    const cashRegisterId = method === 'cash' ? this.#cashRetry.deviceRegister(this.data.locationId) : undefined;
    this.$isSaving.set(true);
    this.#send(dto, cashRegisterId, true);
  }

  #send(base: CreatePayablePaymentDto, cashRegisterId: number | undefined, canRetryWithoutRegister: boolean) {
    const dto: CreatePayablePaymentDto = cashRegisterId ? { ...base, cashRegisterId } : base;
    this.#payables
      .pay(this.data.type, this.data.id, dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (payment) => {
          this.#toast.show(`Pago registrado · saldo ${formatCurrency(payment.balance)}`, 'success');
          this.#dialogRef.close({ payment });
        },
        error: (error: unknown) => this.#handleError(error, base, cashRegisterId, canRetryWithoutRegister),
      });
  }

  #handleError(error: unknown, dto: CreatePayablePaymentDto, cashRegisterId: number | undefined, canRetryWithoutRegister: boolean) {
    const api = readApiError(error);

    if (api.code === ApiErrorCode.PAYABLE_AMOUNT_EXCEEDED && api.status === 400) {
      const balance = Number(api.details['balance']);
      this.$isSaving.set(false);
      if (Number.isFinite(balance) && balance > 0) {
        this.$balance.set(balance);
        this.amount.setValue(balance);
        this.#toast.show(`El saldo cambió: ahora es ${formatCurrency(balance)}. Revisa el monto`, 'warning');
        return;
      }
      this.#toast.show(getFinanceErrorMessage(error), 'error');
      return;
    }

    // Ya pagado, anulado o borrado entretanto: se cierra para recargar.
    if (api.status === 409 && !api.code?.startsWith('CASH_')) {
      this.#toast.show(getFinanceErrorMessage(error, 'Esta deuda cambió. Revisa nuevamente.'), 'warning');
      this.#dialogRef.close({ payment: null });
      return;
    }
    if (api.status === 404) {
      this.#toast.show(getFinanceErrorMessage(error), 'error');
      this.#dialogRef.close({ payment: null });
      return;
    }

    if (dto.method !== 'cash') {
      this.$isSaving.set(false);
      this.#toast.show(getFinanceErrorMessage(error, 'No se pudo registrar el pago'), 'error');
      return;
    }

    this.#cashRetry
      .resolve(api, {
        locationId: this.data.locationId,
        cashRegisterId: cashRegisterId ?? null,
        purpose: 'Para pagar en efectivo la caja debe estar abierta: el dinero sale de ella.',
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((registerId) => {
        if (registerId) return this.#send(dto, registerId, false);
        // La caja recordada ya no sirve (se olvidó): se reintenta una vez sin ella.
        if (registerId === undefined && cashRegisterId && canRetryWithoutRegister && /cash register (not found|is inactive)|belongs to another location/i.test(api.message)) {
          return this.#send(dto, undefined, false);
        }
        this.$isSaving.set(false);
        if (registerId === undefined) this.#toast.show(getFinanceErrorMessage(error, 'No se pudo registrar el pago'), 'error');
      });
  }

  cancel() {
    this.#dialogRef.close();
  }
}

export function openPayPayableModal(dialog: MatDialog, data: PayPayableData): Observable<PayPayableResult | undefined> {
  return dialog
    .open<PayPayableModalComponent, PayPayableData, PayPayableResult>(PayPayableModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
