import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService, UpdateBusinessSettingsDto } from 'src/app/core/services/business-settings';
import { TIME_ZONES } from 'src/app/modules/onboarding/pages/create-business/time-zones';
import { ButtonComponent, CardComponent, IconComponent, ToastService } from 'src/ui';
import { FindAllCurrenciesService, getBusinessErrorMessage, injectIsBusinessOwner, OWNER_ONLY_SETTING_NOTE } from '../../data-access';

const DEFAULT_TIME_ZONE = 'America/Santiago';

/** Sección "Moneda y horario": moneda del negocio y zona horaria. */
@Component({
  selector: 'app-business-currency-section',
  imports: [CardComponent, ButtonComponent, IconComponent],
  templateUrl: './business-currency-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessCurrencySectionComponent {
  readonly #settings = inject(BusinessSettingsService);
  readonly #currencies = inject(FindAllCurrenciesService);
  readonly #toast = inject(ToastService);
  readonly #access = inject(AccessService);
  // Sin permiso de edición la sección queda de solo lectura.
  protected readonly $canEdit = computed(() => this.#access.can(PERMISSIONS.BUSINESS.UPDATE_SETTINGS));
  // La moneda solo la cambia el dueño; la zona horaria, cualquiera con permiso.
  protected readonly $isOwner = injectIsBusinessOwner();
  protected readonly $canEditCurrency = computed(() => this.$canEdit() && this.$isOwner());
  protected readonly ownerOnlyNote = OWNER_ONLY_SETTING_NOTE;

  protected readonly $currencies = computed(() =>
    [...(this.#currencies.$currencies() ?? [])].sort((a, b) => a.currency.localeCompare(b.currency, 'es')),
  );
  protected readonly $currenciesError = computed(() => !!this.#currencies.$hasError());

  readonly #savedCurrencyId = computed(() => this.#settings.$settings()?.currencyId ?? null);
  readonly #savedTimeZone = computed(() => this.#settings.$settings()?.timeZone || DEFAULT_TIME_ZONE);

  protected readonly $currencyId = linkedSignal(() => this.#savedCurrencyId());
  protected readonly $timeZone = linkedSignal(() => this.#savedTimeZone());

  // Si la zona guardada no está en la lista, se agrega para no perderla.
  protected readonly $timeZones = computed(() => {
    const saved = this.#savedTimeZone();
    return TIME_ZONES.some((zone) => zone.value === saved) ? TIME_ZONES : [{ value: saved, label: saved }, ...TIME_ZONES];
  });

  protected readonly $currencyChanged = computed(() => this.$currencyId() !== this.#savedCurrencyId());
  protected readonly $timeZoneChanged = computed(() => this.$timeZone() !== this.#savedTimeZone());
  protected readonly $hasChanges = computed(() => (this.$canEditCurrency() && this.$currencyChanged()) || this.$timeZoneChanged());
  protected readonly $isSaving = signal(false);

  onCurrencyChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.$currencyId.set(Number.isInteger(value) && value > 0 ? value : null);
  }

  onTimeZoneChange(event: Event) {
    this.$timeZone.set((event.target as HTMLSelectElement).value);
  }

  retryCurrencies() {
    this.#currencies.retry();
  }

  discard() {
    this.$currencyId.set(this.#savedCurrencyId());
    this.$timeZone.set(this.#savedTimeZone());
  }

  save() {
    if (!this.$hasChanges() || this.$isSaving()) return;
    const changes: { -readonly [K in keyof UpdateBusinessSettingsDto]: UpdateBusinessSettingsDto[K] } = {};
    const currencyId = this.$currencyId();
    const currencyChanged = this.$canEditCurrency() && this.$currencyChanged() && currencyId !== null;
    if (currencyChanged) changes.currencyId = currencyId;
    if (this.$timeZoneChanged()) changes.timeZone = this.$timeZone();
    this.$isSaving.set(true);
    this.#settings.update(changes).subscribe({
      next: () => {
        this.$isSaving.set(false);
        this.#toast.show('Moneda y horario actualizados', 'success');
        // Al cambiar la moneda el backend ajusta los decimales: se recarga la configuración.
        if (currencyChanged) this.#settings.reload();
      },
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getBusinessErrorMessage(error), 'error');
      },
    });
  }
}
