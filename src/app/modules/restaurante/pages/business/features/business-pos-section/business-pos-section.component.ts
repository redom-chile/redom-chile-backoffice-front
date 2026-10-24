import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { RouterLink } from '@angular/router';
import {
  BusinessSettingsService,
  parsePosSettings,
  PosSettings,
  UpdateBusinessSettingsDto,
} from 'src/app/core/services/business-settings';
import { hasApiErrorCode } from 'src/app/core/utils/api-error';
import { ButtonComponent, CardComponent, ToastService, ToggleComponent } from 'src/ui';
import { TIP_MODE_HINTS, TIP_MODE_LABELS, TipDistributionMode } from 'src/app/modules/finance/data-access';
import { getBusinessErrorMessage } from '../../data-access';

const TIP_MODES: readonly TipDistributionMode[] = ['individual', 'equal', 'points'];

/** Sección "Punto de venta": mesas, meseros, propina sugerida, IVA en la precuenta, reparto de propinas y caja y turnos. */
@Component({
  selector: 'app-business-pos-section',
  imports: [RouterLink, CardComponent, ButtonComponent, ToggleComponent],
  templateUrl: './business-pos-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessPosSectionComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  // Sin permiso de edición la sección queda de solo lectura.
  protected readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.BUSINESS.UPDATE_SETTINGS));

  readonly #saved = this.#settings.$posSettings;
  // Sin valor guardado se muestra 0 (sin sugerencia), que es el default del backend.
  readonly #savedTip = computed(() => {
    const value = Number(this.#settings.$settings()?.suggestedTipPercent ?? 0);
    return Number.isFinite(value) ? value : 0;
  });

  protected readonly $tablesEnabled = linkedSignal(() => this.#saved().tablesEnabled);
  protected readonly $waiterEnabled = linkedSignal(() => this.#saved().waiterEnabled);
  protected readonly $staffRequired = linkedSignal(() => this.#saved().isServiceStaffRequired);
  protected readonly $showTaxOnPreBill = linkedSignal(() => this.#saved().showTaxOnPreBill);
  // Texto del input: permite dejarlo vacío mientras se escribe.
  protected readonly $tipPercent = linkedSignal(() => String(this.#savedTip()));
  protected readonly $cashEnabled = linkedSignal(() => this.#settings.$cashManagementEnabled());
  // Sin valor guardado, el backend reparte "cada mesero lo suyo".
  readonly #savedTipMode = computed<TipDistributionMode>(
    () => this.#settings.$settings()?.tipDistributionMode ?? 'individual',
  );
  protected readonly $tipMode = linkedSignal(() => this.#savedTipMode());
  protected readonly tipModes = TIP_MODES;
  protected readonly tipModeLabels = TIP_MODE_LABELS;
  protected readonly tipModeHints = TIP_MODE_HINTS;

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
    if (this.$showTaxOnPreBill() !== saved.showTaxOnPreBill) changes.showTaxOnPreBill = this.$showTaxOnPreBill();
    return changes;
  });
  readonly #tipChanged = computed(() => this.#tipValue() !== this.#savedTip());
  readonly #cashChanged = computed(() => this.$cashEnabled() !== this.#settings.$cashManagementEnabled());
  readonly #tipModeChanged = computed(() => this.$tipMode() !== this.#savedTipMode());
  protected readonly $hasChanges = computed(
    () =>
      Object.keys(this.#posChanges()).length > 0 || this.#tipChanged() || this.#cashChanged() || this.#tipModeChanged(),
  );
  protected readonly $isValid = computed(() => !this.$tipError());
  protected readonly $isSaving = signal(false);

  onTipInput(event: Event) {
    this.$tipPercent.set((event.target as HTMLInputElement).value);
  }

  onTipModeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as TipDistributionMode;
    if (TIP_MODES.includes(value)) this.$tipMode.set(value);
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
    this.$showTaxOnPreBill.set(saved.showTaxOnPreBill);
    this.$tipPercent.set(String(this.#savedTip()));
    this.$cashEnabled.set(this.#settings.$cashManagementEnabled());
    this.$tipMode.set(this.#savedTipMode());
  }

  save() {
    if (!this.$hasChanges() || !this.$isValid() || this.$isSaving()) return;
    const changes: { -readonly [K in keyof UpdateBusinessSettingsDto]: UpdateBusinessSettingsDto[K] } = {};
    const posChanges = this.#posChanges();
    if (Object.keys(posChanges).length) changes.posSettings = posChanges;
    if (this.#tipChanged()) changes.suggestedTipPercent = this.#tipValue();
    if (this.#cashChanged()) changes.cashManagementEnabled = this.$cashEnabled();
    if (this.#tipModeChanged()) changes.tipDistributionMode = this.$tipMode();
    this.$isSaving.set(true);
    this.#settings.update(changes).subscribe({
      next: () => {
        const showTax = changes.posSettings?.showTaxOnPreBill;
        if (showTax === undefined) {
          this.$isSaving.set(false);
          this.#toast.show('Punto de venta actualizado', 'success');
          return;
        }
        this.#confirmShowTax(showTax, Object.keys(changes).length > 1 || Object.keys(posChanges).length > 1);
      },
      error: (error) => {
        this.$isSaving.set(false);
        // No se puede apagar la caja con turnos abiertos: se vuelve al valor guardado.
        if (changes.cashManagementEnabled === false && hasApiErrorCode(error, 'CASH_SESSION_ALREADY_OPEN')) {
          this.$cashEnabled.set(this.#settings.$cashManagementEnabled());
          this.#toast.show('Cierra las cajas abiertas primero', 'error');
          return;
        }
        this.#toast.show(getBusinessErrorMessage(error), 'error');
      },
    });
  }

  // El backend descarta sin error las opciones que no conoce: se relee para confirmar que guardó la del IVA (#70).
  #confirmShowTax(expected: boolean, savedOthers: boolean) {
    this.#settings.refresh().subscribe({
      next: (settings) => {
        this.$isSaving.set(false);
        const kept = parsePosSettings(settings.posSettings).showTaxOnPreBill === expected;
        // Al releer, el switch vuelve solo al valor que tiene el servidor.
        if (kept || savedOthers) this.#toast.show('Punto de venta actualizado', 'success');
        if (!kept) this.#toast.show('Esta opción estará disponible cuando el servidor la publique (#70).', 'warning');
      },
      error: () => {
        this.$isSaving.set(false);
        // Sin poder confirmar, no se da por guardada: se vuelve al valor previo.
        this.$showTaxOnPreBill.set(!expected);
        this.#settings.reload();
        this.#toast.show(
          'No se pudo confirmar el cambio del IVA en la precuenta. Recarga e intenta de nuevo.',
          'error',
        );
      },
    });
  }
}
