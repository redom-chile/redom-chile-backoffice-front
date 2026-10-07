import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { BusinessSettingsService, PosSettings, UpdateBusinessSettingsDto } from 'src/app/core/services/business-settings';
import { ButtonComponent, CardComponent, ToastService, ToggleComponent } from 'src/ui';
import { getBusinessErrorMessage } from '../../data-access';

/** Sección "Punto de venta": mesas, meseros y propina sugerida al cobrar. */
@Component({
  selector: 'app-business-pos-section',
  imports: [CardComponent, ButtonComponent, ToggleComponent],
  templateUrl: './business-pos-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessPosSectionComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);

  readonly #saved = this.#settings.$posSettings;
  // Sin valor guardado se muestra 0 (sin sugerencia), que es el default del backend.
  readonly #savedTip = computed(() => {
    const value = Number(this.#settings.$settings()?.suggestedTipPercent ?? 0);
    return Number.isFinite(value) ? value : 0;
  });

  protected readonly $tablesEnabled = linkedSignal(() => this.#saved().tablesEnabled);
  protected readonly $waiterEnabled = linkedSignal(() => this.#saved().waiterEnabled);
  protected readonly $staffRequired = linkedSignal(() => this.#saved().isServiceStaffRequired);
  // Texto del input: permite dejarlo vacío mientras se escribe.
  protected readonly $tipPercent = linkedSignal(() => String(this.#savedTip()));

  // Sin meseros no puede exigirse uno al tomar pedidos.
  readonly #effectiveStaffRequired = computed(() => this.$waiterEnabled() && this.$staffRequired());

  readonly #tipValue = computed(() => {
    const raw = this.$tipPercent().trim().replace(',', '.');
    return raw === '' ? NaN : Number(raw);
  });
  protected readonly $tipError = computed(() => {
    const value = this.#tipValue();
    if (!Number.isFinite(value)) return 'Ingresa un porcentaje (0 = sin sugerencia).';
    if (value < 0 || value > 100) return 'Debe estar entre 0 y 100.';
    if (Math.round(value * 100) !== value * 100) return 'Máximo 2 decimales.';
    return null;
  });

  readonly #posChanges = computed<PosSettings>(() => {
    const saved = this.#saved();
    const changes: { -readonly [K in keyof PosSettings]: PosSettings[K] } = {};
    if (this.$tablesEnabled() !== saved.tablesEnabled) changes.tablesEnabled = this.$tablesEnabled();
    if (this.$waiterEnabled() !== saved.waiterEnabled) changes.waiterEnabled = this.$waiterEnabled();
    if (this.#effectiveStaffRequired() !== saved.isServiceStaffRequired)
      changes.isServiceStaffRequired = this.#effectiveStaffRequired();
    return changes;
  });
  readonly #tipChanged = computed(() => this.#tipValue() !== this.#savedTip());
  protected readonly $hasChanges = computed(() => Object.keys(this.#posChanges()).length > 0 || this.#tipChanged());
  protected readonly $isValid = computed(() => !this.$tipError());
  protected readonly $isSaving = signal(false);

  onTipInput(event: Event) {
    this.$tipPercent.set((event.target as HTMLInputElement).value);
  }

  setWaiterEnabled(enabled: boolean) {
    this.$waiterEnabled.set(enabled);
    if (!enabled) this.$staffRequired.set(false);
  }

  discard() {
    const saved = this.#saved();
    this.$tablesEnabled.set(saved.tablesEnabled);
    this.$waiterEnabled.set(saved.waiterEnabled);
    this.$staffRequired.set(saved.isServiceStaffRequired);
    this.$tipPercent.set(String(this.#savedTip()));
  }

  save() {
    if (!this.$hasChanges() || !this.$isValid() || this.$isSaving()) return;
    const changes: { -readonly [K in keyof UpdateBusinessSettingsDto]: UpdateBusinessSettingsDto[K] } = {};
    const posChanges = this.#posChanges();
    if (Object.keys(posChanges).length) changes.posSettings = posChanges;
    if (this.#tipChanged()) changes.suggestedTipPercent = this.#tipValue();
    this.$isSaving.set(true);
    this.#settings.update(changes).subscribe({
      next: () => {
        this.$isSaving.set(false);
        this.#toast.show('Punto de venta actualizado', 'success');
      },
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getBusinessErrorMessage(error), 'error');
      },
    });
  }
}
