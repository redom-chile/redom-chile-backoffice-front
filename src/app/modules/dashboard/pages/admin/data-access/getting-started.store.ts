import { computed, inject, Injectable, signal } from '@angular/core';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';

const storageKey = (businessId: number) => `redom.gettingStarted.hidden.${businessId}`;

function readHidden(businessId: number): boolean {
  try {
    return localStorage.getItem(storageKey(businessId)) === '1';
  } catch {
    return false;
  }
}

/** Si el checklist "Primeros pasos" está oculto para este negocio (preferencia local del navegador). */
@Injectable({ providedIn: 'root' })
export class GettingStartedStore {
  readonly #businessId = inject(BusinessSettingsService).$businessId;
  // Lo elegido en esta sesión manda sobre lo guardado (por si el navegador no deja guardar).
  readonly #overrides = signal<Record<number, boolean>>({});

  readonly $businessId = this.#businessId;
  readonly $hidden = computed(() => {
    const businessId = this.#businessId();
    if (!businessId) return false;
    return this.#overrides()[businessId] ?? readHidden(businessId);
  });

  hide() {
    this.#set(true);
  }

  show() {
    this.#set(false);
  }

  #set(hidden: boolean) {
    const businessId = this.#businessId();
    if (!businessId) return;
    this.#overrides.update((current) => ({ ...current, [businessId]: hidden }));
    try {
      if (hidden) localStorage.setItem(storageKey(businessId), '1');
      else localStorage.removeItem(storageKey(businessId));
    } catch {
      // Sin almacenamiento: queda solo para esta sesión.
    }
  }
}
