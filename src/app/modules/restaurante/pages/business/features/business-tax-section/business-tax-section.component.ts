import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  BusinessSettingsService,
  grossSellPrice,
  roundCurrency,
  SellPriceTax,
  UpdateBusinessSettingsDto,
} from 'src/app/core/services/business-settings';
import { formatRut, isValidRut } from 'src/app/shared/validators';
import { ButtonComponent, CardComponent, ToastService } from 'src/ui';
import { getBusinessErrorMessage } from '../../data-access';

const DEFAULT_VAT_RATE = 19;
const TAX_LABEL = 'RUT';
// Precio de ejemplo para explicar cómo se calcula el IVA.
const EXAMPLE_PRICE = 1000;

const SELL_PRICE_TAX_OPTIONS: ReadonlyArray<{ value: SellPriceTax; label: string; hint: string }> = [
  { value: 'includes', label: 'Incluyen IVA', hint: 'Lo habitual en Chile: el precio es lo que paga el cliente.' },
  { value: 'excludes', label: 'No incluyen IVA', hint: 'El precio es neto: el IVA se suma al vender.' },
];

/** Sección "Datos fiscales": RUT del negocio, IVA y si los precios de los productos lo incluyen. */
@Component({
  selector: 'app-business-tax-section',
  imports: [CardComponent, ButtonComponent],
  templateUrl: './business-tax-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessTaxSectionComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);

  readonly #savedRut = computed(() => this.#settings.$settings()?.taxNumber1?.trim() ?? '');
  readonly #savedVatRate = computed(() => Number(this.#settings.$settings()?.vatRate ?? DEFAULT_VAT_RATE));
  readonly #savedSellPriceTax = computed<SellPriceTax>(() => this.#settings.$settings()?.sellPriceTax ?? 'includes');

  protected readonly $rut = linkedSignal(() => this.#savedRut());
  // Texto del input: permite dejarlo vacío mientras se escribe.
  protected readonly $vatRate = linkedSignal(() => String(this.#savedVatRate()));
  protected readonly $sellPriceTax = linkedSignal(() => this.#savedSellPriceTax());
  protected readonly sellPriceTaxOptions = SELL_PRICE_TAX_OPTIONS;

  protected readonly $rutError = computed(() => {
    const rut = this.$rut().trim();
    return rut && !isValidRut(rut) ? 'RUT inválido. Revisa el dígito verificador.' : null;
  });
  readonly #vatRateValue = computed(() => {
    const raw = this.$vatRate().trim().replace(',', '.');
    return raw === '' ? NaN : Number(raw);
  });
  protected readonly $vatRateError = computed(() => {
    const value = this.#vatRateValue();
    if (!Number.isFinite(value)) return 'Ingresa el porcentaje de IVA.';
    if (value < 0 || value > 100) return 'Debe estar entre 0 y 100.';
    if (Math.round(value * 100) !== value * 100) return 'Máximo 2 decimales.';
    return null;
  });

  readonly #rutChanged = computed(() => this.#normalizedRut() !== this.#savedRut());
  readonly #vatRateChanged = computed(() => this.#vatRateValue() !== this.#savedVatRate());
  readonly #sellPriceTaxChanged = computed(() => this.#sellPriceTax() !== this.#savedSellPriceTax());
  protected readonly $hasChanges = computed(() => this.#rutChanged() || this.#vatRateChanged() || this.#sellPriceTaxChanged());
  protected readonly $isValid = computed(() => !this.$rutError() && !this.$vatRateError());
  protected readonly $isSaving = signal(false);

  readonly #normalizedRut = computed(() => {
    const rut = this.$rut().trim();
    return rut && isValidRut(rut) ? formatRut(rut) : rut;
  });
  readonly #sellPriceTax = this.$sellPriceTax;

  // Ejemplo con el IVA escrito (o el guardado si el valor aún no es válido).
  protected readonly $example = computed(() => {
    const rate = this.$vatRateError() ? this.#savedVatRate() : this.#vatRateValue();
    const decimals = this.#settings.$currencyPrecision();
    const format = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const total = grossSellPrice(EXAMPLE_PRICE, rate, 'excludes', decimals);
    const includedVat = roundCurrency(EXAMPLE_PRICE - EXAMPLE_PRICE / (1 + rate / 100), decimals);
    return {
      price: format.format(EXAMPLE_PRICE),
      total: format.format(total),
      vat: format.format(total - EXAMPLE_PRICE),
      includedVat: format.format(includedVat),
    };
  });

  onRutInput(event: Event) {
    this.$rut.set((event.target as HTMLInputElement).value);
  }

  formatRutOnBlur() {
    this.$rut.set(this.#normalizedRut());
  }

  onVatRateInput(event: Event) {
    this.$vatRate.set((event.target as HTMLInputElement).value);
  }

  discard() {
    this.$rut.set(this.#savedRut());
    this.$vatRate.set(String(this.#savedVatRate()));
    this.$sellPriceTax.set(this.#savedSellPriceTax());
  }

  save() {
    if (!this.$hasChanges() || !this.$isValid() || this.$isSaving()) return;
    const changes: { -readonly [K in keyof UpdateBusinessSettingsDto]: UpdateBusinessSettingsDto[K] } = {};
    if (this.#rutChanged()) {
      const rut = this.#normalizedRut();
      changes.taxNumber1 = rut || null;
      changes.taxLabel1 = TAX_LABEL;
    }
    if (this.#vatRateChanged()) changes.vatRate = this.#vatRateValue();
    if (this.#sellPriceTaxChanged()) changes.sellPriceTax = this.#sellPriceTax();
    this.$isSaving.set(true);
    this.#settings.update(changes).subscribe({
      next: () => {
        this.$isSaving.set(false);
        this.#toast.show('Datos fiscales actualizados', 'success');
      },
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getBusinessErrorMessage(error), 'error');
      },
    });
  }
}
