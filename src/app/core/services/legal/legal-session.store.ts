import { Injectable, signal } from '@angular/core';

const KEY = 'legalRestricted';

function readFlag(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Sesión restringida (#77): el login devolvió un token que solo sirve para aceptar documentos legales.
 * Mientras dure no se carga nada del negocio (whoami, permisos, plan): todo lleva a /legal/accept.
 */
@Injectable({ providedIn: 'root' })
export class LegalSessionStore {
  readonly #restricted = signal(readFlag());
  readonly $restricted = this.#restricted.asReadonly();

  setRestricted(restricted: boolean) {
    this.#restricted.set(restricted);
    try {
      if (restricted) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch {
      // Sin localStorage la restricción dura solo esta pestaña.
    }
  }
}
