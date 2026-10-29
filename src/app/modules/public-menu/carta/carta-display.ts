import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { CartaEmbed } from './carta-embed';

export type CartaThemeMode = 'system' | 'light' | 'dark';

/** El mismo que usa la landing (y su index.html antes de pintar): el modo elegido vale en ambas. */
const MODE_KEY = 'redom-landing.mode';
/** index.html de la landing también lo aplica antes de pintar en /carta. */
const SIZE_KEY = 'redom-carta.text-size';
/** Etapa 8: alto contraste (solo si el local lo ofrece). */
const CONTRAST_KEY = 'redom-carta.contrast';

/** Escala del texto (tamaño de letra raíz): toda la carta usa rem. */
export const CARTA_TEXT_SIZES = [0.875, 1, 1.125, 1.25, 1.375] as const;
const DEFAULT_SIZE_INDEX = 1;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: vale solo para esta visita */
  }
}

/**
 * Modo claro/oscuro y tamaño del texto de la carta pública. Lo activan las páginas públicas (nunca la vista previa
 * del backoffice, que tiene su propio modo). Incrustada con &theme=light|dark, el modo lo decide la web que la incrusta.
 */
@Injectable({ providedIn: 'root' })
export class CartaDisplay {
  readonly #document = inject(DOCUMENT);
  readonly #forced = (inject(CartaEmbed).queryParams['theme'] as 'light' | 'dark' | undefined) ?? null;

  /** El modo lo fija la web que incrusta la carta. */
  readonly modeLocked = !!this.#forced;
  readonly mode = signal<CartaThemeMode>('system');
  readonly sizeIndex = signal(DEFAULT_SIZE_INDEX);
  readonly highContrast = signal(false);
  readonly #systemDark = signal(false);
  readonly #active = signal(false);

  readonly dark = computed(() => {
    if (this.#forced) return this.#forced === 'dark';
    const mode = this.mode();
    return mode === 'dark' || (mode === 'system' && this.#systemDark());
  });
  readonly scale = computed(() => CARTA_TEXT_SIZES[this.sizeIndex()]);
  readonly canGrow = computed(() => this.sizeIndex() < CARTA_TEXT_SIZES.length - 1);
  readonly canShrink = computed(() => this.sizeIndex() > 0);

  constructor() {
    effect(() => {
      if (!this.#active()) return;
      const html = this.#document.documentElement;
      html.classList.toggle('dark', this.dark());
      const scale = this.scale();
      html.style.fontSize = scale === 1 ? '' : `${scale * 100}%`;
    });
  }

  /** Lo llaman las páginas de la carta (solo en el navegador). */
  activate(): void {
    if (this.#active() || typeof window === 'undefined') return;
    const stored = read(MODE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') this.mode.set(stored);
    const size = Number(read(SIZE_KEY));
    const index = CARTA_TEXT_SIZES.indexOf(size as (typeof CARTA_TEXT_SIZES)[number]);
    if (index >= 0) this.sizeIndex.set(index);
    this.highContrast.set(read(CONTRAST_KEY) === '1');
    try {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      this.#systemDark.set(media.matches);
      media.addEventListener('change', (event) => this.#systemDark.set(event.matches));
    } catch {
      /* sin matchMedia: claro */
    }
    this.#active.set(true);
  }

  setMode(mode: CartaThemeMode): void {
    if (this.modeLocked) return;
    this.mode.set(mode);
    write(MODE_KEY, mode);
  }

  toggleContrast(): void {
    const next = !this.highContrast();
    this.highContrast.set(next);
    write(CONTRAST_KEY, next ? '1' : '0');
  }

  grow(): void {
    this.#setSize(this.sizeIndex() + 1);
  }

  shrink(): void {
    this.#setSize(this.sizeIndex() - 1);
  }

  resetSize(): void {
    this.#setSize(DEFAULT_SIZE_INDEX);
  }

  #setSize(index: number): void {
    const next = Math.min(CARTA_TEXT_SIZES.length - 1, Math.max(0, index));
    this.sizeIndex.set(next);
    write(SIZE_KEY, String(CARTA_TEXT_SIZES[next]));
  }
}
