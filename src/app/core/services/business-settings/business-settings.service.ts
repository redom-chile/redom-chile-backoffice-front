import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { WhoamiService } from '../whoami/whoami.service';
import {
  BusinessSettingsDto,
  InventorySettings,
  PosSettings,
  SellPriceTax,
  UpdateInventorySettingsDto,
  UpdateBusinessSettingsDto,
} from './dtos';

const DEFAULT_INVENTORY: InventorySettings = {
  inventoryEnabled: false,
  deductStockOnSale: false,
  ingredientsEnabled: false,
  stockDeductionMoment: 'on_order',
  allowNegativeStock: true,
};

const DEFAULT_VAT_RATE = 19;
// Propina sugerida si la configuración aún no llega (comportamiento previo).
export const FALLBACK_TIP_PERCENT = 10;

/** Opciones del POS normalizadas: siempre con los tres valores. */
export type ResolvedPosSettings = Readonly<Required<PosSettings>>;

/**
 * El GET devuelve pos_settings como texto JSON con claves snake_case
 * ({ waiter_enabled, tables_enabled, is_service_staff_required }); se acepta también un objeto.
 */
export function parsePosSettings(raw: unknown): ResolvedPosSettings {
  let stored: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed;
    } catch {
      // Valor inválido: se usan los valores por defecto.
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    stored = raw as Record<string, unknown>;
  }
  const flag = (camel: string, snake: string) => (stored[camel] ?? stored[snake]) === true;
  return {
    tablesEnabled: flag('tablesEnabled', 'tables_enabled'),
    waiterEnabled: flag('waiterEnabled', 'waiter_enabled'),
    isServiceStaffRequired: flag('isServiceStaffRequired', 'is_service_staff_required'),
  };
}

/** Redondea un monto a los decimales de la moneda (CLP: 0). */
export function roundCurrency(amount: number, decimals: number): number {
  const factor = 10 ** Math.max(0, Math.floor(decimals));
  return Math.round(amount * factor) / factor;
}

/** Precio que paga el cliente: con 'excludes' el precio del catálogo es neto y se le suma el IVA. */
export function grossSellPrice(price: number, vatRate: number, sellPriceTax: SellPriceTax, decimals: number): number {
  if (sellPriceTax !== 'excludes') return price;
  return roundCurrency(price * (1 + vatRate / 100), decimals);
}

function normalizeSettings(settings: BusinessSettingsDto): BusinessSettingsDto {
  const tip = settings.suggestedTipPercent;
  return {
    ...settings,
    posSettings: parsePosSettings(settings.posSettings),
    suggestedTipPercent: tip === null || tip === undefined || !Number.isFinite(Number(tip)) ? tip : Number(tip),
    vatRate: settings.vatRate === undefined || settings.vatRate === null ? settings.vatRate : Number(settings.vatRate),
  };
}

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

  // Caja y turnos activos (apagado: el POS cobra sin caja).
  readonly $cashManagementEnabled = computed(() => !!this.#settings()?.cashManagementEnabled);
  readonly $posSettings = computed<ResolvedPosSettings>(() => parsePosSettings(this.#settings()?.posSettings));
  /** Propina sugerida (%): 0 = sin sugerencia; sin configuración cargada se usa el valor previo (10). */
  readonly $suggestedTipPercent = computed(() => {
    const value = this.#settings()?.suggestedTipPercent;
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? FALLBACK_TIP_PERCENT : Number(value);
  });
  readonly $vatRate = computed(() => {
    const value = Number(this.#settings()?.vatRate ?? DEFAULT_VAT_RATE);
    return Number.isFinite(value) ? value : DEFAULT_VAT_RATE;
  });
  readonly $sellPriceTax = computed<SellPriceTax>(() => (this.#settings()?.sellPriceTax === 'excludes' ? 'excludes' : 'includes'));
  /** true cuando el precio del catálogo es neto y el IVA se suma al vender. */
  readonly $pricesExcludeVat = computed(() => this.$sellPriceTax() === 'excludes');
  readonly $currencyPrecision = computed(() => {
    const value = Number(this.#settings()?.currencyPrecision ?? 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  });

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
        this.#settings.set(normalizeSettings(settings));
        this.#isLoading.set(false);
      },
      error: () => {
        this.#hasError.set(true);
        this.#isLoading.set(false);
      },
    });
  }

  /** Guarda datos generales (nombre, moneda, zona horaria, fiscales, POS) y actualiza el estado local. */
  update(changes: UpdateBusinessSettingsDto): Observable<unknown> {
    const businessId = this.$businessId();
    return this.#http.patch(`${ApiPathEnum.RESTAURANT}/business/${businessId}/settings`, changes).pipe(
      tap(() =>
        this.#settings.update((current) => {
          if (!current) return current;
          // posSettings es un PATCH parcial: se mezcla con lo que ya había.
          const posSettings = changes.posSettings
            ? { ...parsePosSettings(current.posSettings), ...changes.posSettings }
            : current.posSettings;
          return { ...current, ...changes, posSettings };
        }),
      ),
    );
  }

  /** Guarda solo los campos cambiados y actualiza el estado local al confirmar. */
  updateInventory(changes: UpdateInventorySettingsDto): Observable<unknown> {
    const businessId = this.$businessId();
    return this.#http.patch(`${ApiPathEnum.RESTAURANT}/business/${businessId}/settings`, changes).pipe(
      tap(() => this.#settings.update((current) => (current ? { ...current, ...changes } : current))),
    );
  }
}
