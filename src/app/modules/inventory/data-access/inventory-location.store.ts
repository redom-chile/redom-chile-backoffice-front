import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';

const STORAGE_KEY = 'redom.inventory.location';

function readStored(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Local elegido en inventario (cada local tiene su propio stock). Recuerda el último elegido
 * y, si no hay uno válido, toma el primer local.
 */
@Injectable({ providedIn: 'root' })
export class InventoryLocationStore {
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly #selected = signal<number | null>(readStored());

  readonly $locations = computed(() => this.#locationsService.$locations() ?? []);
  readonly $isLoading = computed(() => this.#locationsService.$isLoading() ?? false);
  readonly $hasError = computed(() => this.#locationsService.$hasError() ?? false);

  /** Local válido elegido (o el primero); null mientras cargan los locales o si no hay ninguno. */
  readonly $locationId = computed(() => {
    const locations = this.$locations();
    const selected = this.#selected();
    if (locations.some((location) => location.id === selected)) return selected;
    return locations[0]?.id ?? null;
  });
  readonly $location = computed(() => this.$locations().find((location) => location.id === this.$locationId()) ?? null);

  constructor() {
    effect(() => {
      const id = this.$locationId();
      if (id === null) return;
      try {
        localStorage.setItem(STORAGE_KEY, String(id));
      } catch {
        /* sin almacenamiento: solo no se recuerda */
      }
    });
  }

  select(locationId: number) {
    this.#selected.set(locationId);
  }

  reload() {
    this.#locationsService.retry();
  }
}
