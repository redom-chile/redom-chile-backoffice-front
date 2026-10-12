import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { CashDeviceStore, CashRegisterDto, CashService } from '../../data-access';

/**
 * Caja del dispositivo en el POS: cajas del local, la elegida (o la única activa) y su turno abierto.
 * Con el módulo apagado (o fuera del plan) no carga nada.
 */
@Injectable({ providedIn: 'root' })
export class CashContextStore {
  readonly #cash = inject(CashService);
  readonly #device = inject(CashDeviceStore);
  readonly #settings = inject(BusinessSettingsService);

  readonly #locationId = signal<number | null>(null);
  readonly #registers = signal<CashRegisterDto[] | null>(null);
  readonly #isLoading = signal(false);
  readonly #hasError = signal(false);
  #request: Subscription | null = null;

  // Sin la función `cash` en el plan se cobra sin caja aunque el negocio la tenga activada.
  readonly $enabled = this.#settings.$cashActive;
  readonly $locationId = this.#locationId.asReadonly();
  readonly $isLoading = this.#isLoading.asReadonly();
  readonly $hasError = this.#hasError.asReadonly();
  readonly $loaded = computed(() => this.#registers() !== null);
  readonly $activeRegisters = computed(() => (this.#registers() ?? []).filter((register) => register.isActive));

  // La guardada en el dispositivo si sigue activa; si no, la única activa del local.
  readonly $register = computed<CashRegisterDto | null>(() => {
    const active = this.$activeRegisters();
    const stored = this.#device.registerFor(this.#locationId());
    const found = stored ? active.find((register) => register.id === stored) : undefined;
    if (found) return found;
    return active.length === 1 ? active[0] : null;
  });
  // Varias cajas y ninguna elegida en este dispositivo.
  readonly $needsChoice = computed(() => this.$loaded() && !this.$register() && this.$activeRegisters().length > 1);
  readonly $openSession = computed(() => this.$register()?.openSession ?? null);

  constructor() {
    // Carga al elegir local o cuando llega la configuración con el módulo activo.
    effect(() => {
      if (this.$enabled() && this.#locationId()) untracked(() => this.refresh());
    });
  }

  setLocation(locationId: number | null) {
    if (this.#locationId() === locationId) return;
    this.#request?.unsubscribe();
    this.#locationId.set(locationId);
    this.#registers.set(null);
  }

  refresh() {
    const locationId = this.#locationId();
    if (!locationId || !this.$enabled()) return;
    this.#request?.unsubscribe();
    this.#isLoading.set(true);
    this.#request = this.#cash.getRegisters({ locationId }).subscribe({
      next: (registers) => {
        // Si cambió el local mientras cargaba, se descarta.
        if (this.#locationId() !== locationId) return;
        this.#registers.set(registers);
        this.#hasError.set(false);
        this.#isLoading.set(false);
      },
      error: () => {
        this.#hasError.set(true);
        this.#isLoading.set(false);
      },
    });
  }

  selectRegister(registerId: number | null) {
    const locationId = this.#locationId();
    if (locationId) this.#device.select(locationId, registerId);
  }

  clear() {
    this.#request?.unsubscribe();
    this.#locationId.set(null);
    this.#registers.set(null);
    this.#isLoading.set(false);
  }
}
