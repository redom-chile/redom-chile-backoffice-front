import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  CreatePaymentDto,
  CreatePaymentService,
  getPaymentErrorMessage,
  PaymentMethod,
} from 'src/app/modules/payments/pages/payment-list/data-access';
import { PAYMENT_METHODS, paymentMethodLabel } from 'src/app/modules/payments/pages/payment-list/ui';
import { formatCurrency } from '../../../order-list/ui';
import { OrderDetailDto } from '../../data-access';

export type CollectPaymentResult = 'paid' | 'partial' | 'dismissed';

type RegisteredPayment = Readonly<{ method: PaymentMethod; amount: number; tip: number; change: number }>;

// Propina sugerida habitual en Chile.
const TIP_PERCENTAGES = [0, 10];
const CASH_BILLS = [5000, 10000, 20000];

@Component({
  selector: 'app-collect-payment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './collect-payment-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectPaymentModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<CollectPaymentModalComponent, CollectPaymentResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly paymentService = inject(CreatePaymentService);

  readonly order = inject<OrderDetailDto>(MAT_DIALOG_DATA);
  readonly methods = PAYMENT_METHODS;
  readonly tipPercentages = TIP_PERCENTAGES;
  readonly formatCurrency = formatCurrency;
  readonly methodLabel = paymentMethodLabel;

  readonly $remaining = signal(this.order.remaining);
  readonly $registered = signal<RegisteredPayment[]>([]);
  // Último pago en efectivo con vuelto: se muestra destacado hasta continuar.
  readonly $lastChange = signal<RegisteredPayment | null>(null);
  readonly $isLoading = computed(() => this.paymentService.$isLoading() ?? false);

  readonly form = inject(FormBuilder).nonNullable.group({
    method: ['cash' as PaymentMethod],
    amount: [this.order.remaining],
    tipAmount: [0],
    amountTendered: [null as number | null],
    note: [''],
  });

  readonly $value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly $isCash = computed(() => this.$value().method === 'cash');
  readonly $amount = computed(() => Number(this.$value().amount) || 0);
  readonly $tip = computed(() => Number(this.$value().tipAmount) || 0);
  readonly $due = computed(() => this.$amount() + this.$tip());
  readonly $tendered = computed(() => Number(this.$value().amountTendered) || 0);
  readonly $change = computed(() => (this.$isCash() && this.$tendered() > 0 ? this.$tendered() - this.$due() : 0));
  readonly $cashOptions = computed(() => {
    const due = this.$due();
    return [due, ...CASH_BILLS.map((bill) => Math.ceil(due / bill) * bill)].filter(
      (value, index, list) => value > 0 && list.indexOf(value) === index,
    );
  });
  readonly $isPaid = computed(() => this.$remaining() <= 0);

  // La interfaz impide pagar más que el saldo (el backend también lo valida).
  readonly $validationError = computed(() => {
    const amount = this.$amount();
    if (amount <= 0) return 'Ingresa el monto a pagar';
    if (amount > this.$remaining()) return `El monto no puede superar el saldo (${formatCurrency(this.$remaining())})`;
    if (this.$tip() < 0) return 'La propina no puede ser negativa';
    if (this.$isCash() && this.$tendered() > 0 && this.$tendered() < this.$due())
      return 'El efectivo recibido no cubre el monto más la propina';
    return null;
  });

  constructor() {
    effect(() => {
      const result = this.paymentService.$result();
      if (!result) return;
      const { request } = result;
      const payment: RegisteredPayment = {
        method: request.method,
        amount: request.amount,
        tip: request.tipAmount ?? 0,
        change: result.changeAmount,
      };
      this.$registered.update((list) => [...list, payment]);
      this.$remaining.set(result.remaining);
      this.$lastChange.set(payment.change > 0 ? payment : null);
      this.paymentService.reset();
      if (result.remaining > 0) {
        this.toast.show(`Pago registrado. Saldo: ${formatCurrency(result.remaining)}`, 'success');
        this.form.reset({ method: 'cash', amount: result.remaining, tipAmount: 0, amountTendered: null, note: '' });
      }
    });

    effect(() => {
      // El modal queda abierto (con el monto ingresado) para reintentar, p. ej. tras registrar stock.
      const error = this.paymentService.$error();
      if (error) this.toast.show(getPaymentErrorMessage(error), 'error');
    });
  }

  selectMethod(method: PaymentMethod) {
    this.form.patchValue({ method, amountTendered: null });
  }

  setAmount(amount: number) {
    this.form.patchValue({ amount });
  }

  setHalf() {
    this.setAmount(Math.ceil(this.$remaining() / 2));
  }

  setTipPercentage(percentage: number) {
    this.form.patchValue({ tipAmount: Math.round((this.$amount() * percentage) / 100) });
  }

  setTendered(value: number) {
    this.form.patchValue({ amountTendered: value });
  }

  handleSubmit() {
    const error = this.$validationError();
    if (error) {
      this.toast.show(error, 'warning');
      return;
    }
    const { method, note } = this.form.getRawValue();
    const dto: CreatePaymentDto = {
      transactionId: this.order.transactionId,
      amount: this.$amount(),
      method,
      tipAmount: this.$tip() || undefined,
      amountTendered: this.$isCash() && this.$tendered() > 0 ? this.$tendered() : undefined,
      note: note.trim() || undefined,
    };
    this.$lastChange.set(null);
    this.paymentService.create(dto);
  }

  dismissChange() {
    this.$lastChange.set(null);
  }

  handleClose() {
    const result: CollectPaymentResult = this.$isPaid() ? 'paid' : this.$registered().length ? 'partial' : 'dismissed';
    this.dialogRef.close(result);
  }

  ngOnDestroy(): void {
    this.paymentService.reset();
  }
}
