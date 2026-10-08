import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import {
  getFinanceErrorMessage,
  PaymentFeesService,
  PaymentMethodSettingDto,
  UpdatePaymentMethodSettingDto,
} from 'src/app/modules/finance/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, IconComponent, ToastService, ToggleComponent } from 'src/ui';
import {
  formatDecimalInput,
  hasMaxDecimals,
  parseDecimalInput,
  paymentFee,
  settlementDate,
  settlementDayLabel,
} from './payment-fee-math';

const EXAMPLE_AMOUNT = 10_000;

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Tarjeta de un medio de pago: comisión y días hasta el abono. Guarda solo lo cambiado. */
@Component({
  selector: 'app-payment-method-card',
  imports: [ButtonComponent, IconComponent, ToggleComponent],
  templateUrl: './payment-method-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodCardComponent {
  readonly #fees = inject(PaymentFeesService);
  readonly #toast = inject(ToastService);

  readonly setting = input.required<PaymentMethodSettingDto>();
  readonly vatRate = input(19);
  readonly decimals = input(0);
  readonly saved = output<PaymentMethodSettingDto>();

  readonly $label = computed(() => PAYMENT_METHOD_LABELS[this.setting().method] ?? this.setting().method);
  readonly $inputId = computed(() => `pm-${this.setting().method}`);

  // Textos de los inputs (permiten dejarlos vacíos mientras se escribe).
  readonly $feePercent = linkedSignal(() => formatDecimalInput(this.setting().feePercent));
  readonly $feeFixed = linkedSignal(() => formatDecimalInput(this.setting().feeFixed));
  readonly $settlementDays = linkedSignal(() => String(this.setting().settlementDays));
  readonly $feeVat = linkedSignal(() => this.setting().feeVat);
  readonly $businessDays = linkedSignal(() => this.setting().businessDays);
  readonly $isSaving = signal(false);

  readonly #feePercentValue = computed(() => parseDecimalInput(this.$feePercent()));
  readonly #feeFixedValue = computed(() => parseDecimalInput(this.$feeFixed()));
  readonly #settlementDaysValue = computed(() => parseDecimalInput(this.$settlementDays()));

  readonly $feePercentError = computed(() => {
    const value = this.#feePercentValue();
    if (!Number.isFinite(value)) return 'Ingresa el porcentaje (0 si no cobra).';
    if (value < 0 || value > 100) return 'Debe estar entre 0 y 100.';
    if (!hasMaxDecimals(value, 4)) return 'Máximo 4 decimales.';
    return null;
  });
  readonly $feeFixedError = computed(() => {
    const value = this.#feeFixedValue();
    if (!Number.isFinite(value)) return 'Ingresa el monto (0 si no cobra).';
    if (value < 0) return 'No puede ser negativo.';
    if (!hasMaxDecimals(value, 4)) return 'Máximo 4 decimales.';
    return null;
  });
  readonly $settlementDaysError = computed(() => {
    const value = this.#settlementDaysValue();
    if (!Number.isInteger(value)) return 'Ingresa un número entero de días.';
    if (value < 0 || value > 90) return 'Debe estar entre 0 y 90.';
    return null;
  });
  readonly $isValid = computed(
    () => !this.$feePercentError() && !this.$feeFixedError() && !this.$settlementDaysError(),
  );

  readonly #changes = computed<UpdatePaymentMethodSettingDto>(() => {
    const saved = this.setting();
    const changes: Mutable<UpdatePaymentMethodSettingDto> = {};
    if (!this.$feePercentError() && this.#feePercentValue() !== saved.feePercent)
      changes.feePercent = this.#feePercentValue();
    if (!this.$feeFixedError() && this.#feeFixedValue() !== saved.feeFixed) changes.feeFixed = this.#feeFixedValue();
    if (this.$feeVat() !== saved.feeVat) changes.feeVat = this.$feeVat();
    if (!this.$settlementDaysError() && this.#settlementDaysValue() !== saved.settlementDays)
      changes.settlementDays = this.#settlementDaysValue();
    if (this.$businessDays() !== saved.businessDays) changes.businessDays = this.$businessDays();
    return changes;
  });
  readonly $hasChanges = computed(() => Object.keys(this.#changes()).length > 0);

  // Ejemplo con lo escrito (o lo guardado si un campo no es válido).
  readonly $example = computed(() => {
    const saved = this.setting();
    const feePercent = this.$feePercentError() ? saved.feePercent : this.#feePercentValue();
    const feeFixed = this.$feeFixedError() ? saved.feeFixed : this.#feeFixedValue();
    const days = this.$settlementDaysError() ? saved.settlementDays : this.#settlementDaysValue();
    const fee = paymentFee(
      EXAMPLE_AMOUNT,
      { feePercent, feeFixed, feeVat: this.$feeVat() },
      this.vatRate(),
      this.decimals(),
    );
    const today = new Date();
    return {
      amount: formatCurrency(EXAMPLE_AMOUNT),
      fee: formatCurrency(fee),
      net: formatCurrency(EXAMPLE_AMOUNT - fee),
      day: settlementDayLabel(settlementDate(today, days, this.$businessDays()), today),
    };
  });

  onText(target: 'feePercent' | 'feeFixed' | 'settlementDays', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (target === 'feePercent') this.$feePercent.set(value);
    else if (target === 'feeFixed') this.$feeFixed.set(value);
    else this.$settlementDays.set(value);
  }

  discard() {
    const saved = this.setting();
    this.$feePercent.set(formatDecimalInput(saved.feePercent));
    this.$feeFixed.set(formatDecimalInput(saved.feeFixed));
    this.$settlementDays.set(String(saved.settlementDays));
    this.$feeVat.set(saved.feeVat);
    this.$businessDays.set(saved.businessDays);
  }

  save() {
    if (!this.$hasChanges() || !this.$isValid() || this.$isSaving()) return;
    this.$isSaving.set(true);
    this.#fees.updateSetting(this.setting().method, this.#changes()).subscribe({
      next: (setting) => {
        this.$isSaving.set(false);
        this.#toast.show(`${this.$label()}: comisión guardada`, 'success');
        this.saved.emit(setting);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getFinanceErrorMessage(error, 'No se pudo guardar la comisión.'), 'error');
      },
    });
  }
}
