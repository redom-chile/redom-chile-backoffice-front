import { Injectable, signal } from '@angular/core';

const KEY = 'redom.cash.register';

/**
 * Caja con la que trabaja este dispositivo, por local (comodidad del equipo, no estado compartido).
 * Si el almacenamiento falla (modo privado), queda en memoria.
 */
@Injectable({ providedIn: 'root' })
export class CashDeviceStore {
  readonly #byLocation = signal<Record<number, number>>(read());

  registerFor(locationId: number | null | undefined): number | null {
    if (!locationId) return null;
    return this.#byLocation()[locationId] ?? null;
  }

  select(locationId: number, registerId: number | null) {
    this.#byLocation.update((current) => {
      const next = { ...current };
      if (registerId === null) delete next[locationId];
      else next[locationId] = registerId;
      write(next);
      return next;
    });
  }
}

function read(): Record<number, number> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<number, number>) : {};
  } catch {
    return {};
  }
}

function write(value: Record<number, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: queda en memoria.
  }
}
