import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { UrlTree } from '@angular/router';
import { CartaI18n } from './carta-i18n';

/**
 * Carta incrustada en otra web (?embed=1, la usa el widget: projects/landing/public/widget.js).
 *
 * Mensajes con la página que la incrusta (window.parent):
 * - la carta envía { type: 'redom-menu:height', height } al cambiar su alto (y al menos EMBED_DIALOG_MIN_HEIGHT con un
 *   diálogo abierto), y { type: 'redom-menu:scroll', top } para desplazarse cuando el iframe crece con su contenido;
 * - el widget envía { type: 'redom-menu:viewport', top, height, auto }: la parte visible del iframe (en px, relativa a
 *   él). Con ella, la barra inferior, la barra de categorías y los diálogos se ubican en lo que el cliente ve.
 * Sin el widget (un <iframe> de alto fijo con su propio scroll) todo funciona como en la carta normal.
 */

/** Alto mínimo que pide la carta mientras haya un diálogo (hoja) abierto. */
export const EMBED_DIALOG_MIN_HEIGHT = 640;

/** Diálogos abiertos (los cuenta CartaDialog). */
export const cartaOpenDialogs = signal(0);

/** Lo que no corresponde dentro de otra web: alto de pantalla completa y posiciones fijas al borde del iframe. */
const EMBED_CSS = `
html[data-carta-embed] { background: var(--background); }
html[data-carta-embed] .min-h-dvh { min-height: 0 !important; }
html[data-carta-vp] .carta-embed-sticky { top: var(--carta-vp-top) !important; }
html[data-carta-vp] .carta-embed-bottom {
  top: calc(var(--carta-vp-top) + var(--carta-vp-height)) !important;
  bottom: auto !important;
  transform: translateY(-100%);
}
html[data-carta-vp] dialog.carta-dialog {
  top: calc(var(--carta-vp-top) + var(--carta-vp-height)) !important;
  bottom: auto !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  transform: translateY(-100%);
  max-height: calc(var(--carta-vp-height) - 0.5rem);
}
html[data-carta-vp] dialog.carta-dialog .carta-dialog-body { max-height: calc(var(--carta-vp-height) - 0.5rem); }
@media (min-width: 640px) {
  html[data-carta-vp] dialog.carta-dialog {
    top: calc(var(--carta-vp-top) + var(--carta-vp-height) / 2) !important;
    transform: translateY(-50%);
    max-height: calc(var(--carta-vp-height) - 2rem);
  }
  html[data-carta-vp] dialog.carta-dialog .carta-dialog-body { max-height: calc(var(--carta-vp-height) - 2rem); }
}
`;

type Viewport = Readonly<{ top: number; height: number; auto: boolean }>;

/** ?embed=1 (y &theme=light|dark, que index.html de la landing aplica antes de pintar). */
function readEmbedParams(): Record<string, string> | null {
  if (typeof location === 'undefined') return null;
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('embed') !== '1') return null;
    const theme = params.get('theme');
    return theme === 'light' || theme === 'dark' ? { embed: '1', theme } : { embed: '1' };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class CartaEmbed {
  readonly #document = inject(DOCUMENT);
  readonly #meta = inject(Meta);

  readonly #embedParams: Readonly<Record<string, string>> = readEmbedParams() ?? {};
  readonly #i18n = inject(CartaI18n);
  readonly #params = computed(() => ({ ...this.#embedParams, ...this.#i18n.queryParams() }));
  /** Se decide con la URL de entrada y se mantiene en las navegaciones internas. */
  readonly active = 'embed' in this.#embedParams;

  /** Para conservar ?embed=1 (y theme) y ?lang= en los enlaces y navegaciones de la carta. */
  get queryParams(): Readonly<Record<string, string>> {
    return this.#params();
  }

  /** Lo último que avisó el widget; null: sin widget (o aún no avisa). */
  #viewport: Viewport | null = null;
  #lastHeight = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.active || typeof window === 'undefined') return;
    const root = this.#document.documentElement;
    root.setAttribute('data-carta-embed', '');
    const style = this.#document.createElement('style');
    style.textContent = EMBED_CSS;
    this.#document.head.appendChild(style);
    this.#meta.updateTag({ name: 'robots', content: 'noindex' });

    if (window.parent === window) return;
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.#schedule()).observe(this.#document.body);
    window.addEventListener('load', () => this.#schedule());
    window.addEventListener('message', (event) => this.#onMessage(event));
    effect(() => {
      cartaOpenDialogs();
      this.#schedule();
    });
    this.#schedule();
  }

  /** Agrega ?embed=1 y ?lang= a una navegación. */
  withParams(tree: UrlTree): UrlTree {
    tree.queryParams = { ...tree.queryParams, ...this.queryParams };
    return tree;
  }

  /**
   * Desplaza hasta `top` (px desde el inicio de la carta). Si el iframe crece con su contenido (widget), le pide a la
   * página que se desplace; si no, se desplaza la carta.
   */
  scrollTo(top: number, behavior: ScrollBehavior): void {
    if (this.active && this.#viewport?.auto && window.parent !== window) {
      window.parent.postMessage({ type: 'redom-menu:scroll', top: Math.max(0, Math.round(top)), smooth: behavior === 'smooth' }, '*');
      return;
    }
    window.scrollTo({ top, behavior });
  }

  #onMessage(event: MessageEvent): void {
    if (event.source !== window.parent) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== 'object' || data['type'] !== 'redom-menu:viewport') return;
    const top = Number(data['top']);
    const height = Number(data['height']);
    if (!Number.isFinite(top) || !Number.isFinite(height)) return;
    this.#viewport = { top, height, auto: data['auto'] === true };
    this.#applyViewport();
  }

  /** Variables CSS con la parte visible del iframe (con un alto mínimo usable para los diálogos). */
  #applyViewport(): void {
    const vp = this.#viewport;
    if (!vp) return;
    const root = this.#document.documentElement;
    const docHeight = Math.max(root.clientHeight, 1);
    const height = Math.min(docHeight, Math.max(vp.height, 360));
    const top = Math.max(0, Math.min(vp.top, docHeight - height));
    root.style.setProperty('--carta-vp-top', `${Math.round(top)}px`);
    root.style.setProperty('--carta-vp-height', `${Math.round(height)}px`);
    root.setAttribute('data-carta-vp', '');
  }

  /** Avisa el alto como máximo cada 100 ms. */
  #schedule(): void {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#postHeight();
    }, 100);
  }

  #postHeight(): void {
    const body = this.#document.body;
    let height = Math.ceil(body.getBoundingClientRect().height);
    if (cartaOpenDialogs() > 0) height = Math.max(height, EMBED_DIALOG_MIN_HEIGHT);
    if (height === this.#lastHeight || height <= 0) return;
    this.#lastHeight = height;
    window.parent.postMessage({ type: 'redom-menu:height', height }, '*');
  }
}
