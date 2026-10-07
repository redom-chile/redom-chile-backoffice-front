import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { WhoamiService } from '../whoami/whoami.service';
import { BusinessSettingsDto, InventorySettings, UpdateInventorySettingsDto } from './dtos';

const DEFAULT_INVENTORY: InventorySettings = {
  inventoryEnabled: false,
  deductStockOnSale: false,
  ingredientsEnabled: false,
  stockDeductionMoment: 'on_payment',
  allowNegativeStock: true,
};

/**
 * Configuración del negocio actual (GET/PATCH /business/:id/settings).
 * Se carga al conocer el restaurantId y la comparten el menú, productos e inventario.
 */
@Injectable({ providedIn: 'root' })
export class BusinessSettingsService {
  readonly #http = inject(HttpClient);
  readonly #whoami = inject(WhoamiService);

  readonly #settings = signal<BusinessSettingsDto | null>(null);
  readonly #isLoading = signal(false);
  readonly #hasError = signal(false);
  #loadedFor: number | null = null;

  readonly $businessId = computed(() => this.#whoami.$whoami()?.user.restaurantId ?? null);
  readonly $settings = this.#settings.asReadonly();
  readonly $isLoading = this.#isLoading.asReadonly();
  readonly $hasError = this.#hasError.asReadonly();
  /** true cuando ya llegó la configuración (para no ocultar/mostrar cosas antes de tiempo). */
  readonly $isLoaded = computed(() => this.#settings() !== null);

  readonly $inventory = computed<InventorySettings>(() => {
    const settings = this.#settings();
    if (!settings) return DEFAULT_INVENTORY;
    return {
      inventoryEnabled: settings.inventoryEnabled ?? DEFAULT_INVENTORY.inventoryEnabled,
      deductStockOnSale: settings.deductStockOnSale ?? DEFAULT_INVENTORY.deductStockOnSale,
      ingredientsEnabled: settings.ingredientsEnabled ?? DEFAULT_INVENTORY.ingredientsEnabled,
      stockDeductionMoment: settings.stockDeductionMoment ?? DEFAULT_INVENTORY.stockDeductionMoment,
      allowNegativeStock: settings.allowNegativeStock ?? DEFAULT_INVENTORY.allowNegativeStock,
    };
  });
  readonly $inventoryEnabled = computed(() => this.$inventory().inventoryEnabled);
  readonly $ingredientsEnabled = computed(() => this.$inventory().inventoryEnabled && this.$inventory().ingredientsEnabled);

  constructor() {
    effect(() => {
      const businessId = this.$businessId();
      if (!businessId || businessId === this.#loadedFor) return;
      this.#loadedFor = businessId;
      untracked(() => this.reload());
    });
  }

  reload() {
    const businessId = this.$businessId();
    if (!businessId) return;
    this.#isLoading.set(true);
    this.#hasError.set(false);
    this.#http.get<BusinessSettingsDto>(`${ApiPathEnum.RESTAURANT}/business/${businessId}/settings`).subscribe({
      next: (settings) => {
        this.#settings.set(settings);
        this.#isLoading.set(false);
      },
      error: () => {
        this.#hasError.set(true);
        this.#isLoading.set(false);
      },
    });
  }

  /** Guarda solo los campos cambiados y actualiza el estado local al confirmar. */
  updateInventory(changes: UpdateInventorySettingsDto): Observable<unknown> {
    const businessId = this.$businessId();
    return this.#http.patch(`${ApiPathEnum.RESTAURANT}/business/${businessId}/settings`, changes).pipe(
      tap(() => this.#settings.update((current) => (current ? { ...current, ...changes } : current))),
    );
  }
}
