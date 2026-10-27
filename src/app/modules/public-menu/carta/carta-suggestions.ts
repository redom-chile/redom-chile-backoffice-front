import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, PLATFORM_ID, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { PublicSuggestionDto } from '../data-access/dtos/menu-dynamic.dto';
import { PublicLocationMenuDto, PublicProductDto } from '../data-access/dtos/public-menu.dto';
import { PublicMenuApiService } from '../data-access/public-menu-api.service';
import { CartaAnalytics } from './carta-analytics';
import { blockedProducts, CartaCart } from './carta-cart';
import { productsById } from './carta-marketing';

// El backend limita a 60 pedidos por minuto por IP y a 50 líneas por pedido
const DEBOUNCE = 600;
const MAX_SHOWN = 6;
const MAX_ITEMS = 50;

export type CartaSuggestion = Readonly<{ product: PublicProductDto; message: string | null; reason: PublicSuggestionDto['reason'] }>;

/** Necesita el detalle para elegir: pack, modificadores o varias variaciones. */
export const needsDetail = (p: PublicProductDto) => !!p.pack || !!p.modifierSets?.some((s) => s.options.length) || p.variations.length !== 1;

/**
 * Etapa 11, "Completa tu pedido": con dynamic.suggestionsEnabled y el carrito activo, pide sugerencias para lo que
 * hay en el carrito (con espera y en caché por contenido). Si la llamada falla no se muestra nada: nunca bloquea el pedido.
 * Se provee en la vista de la carta, junto al carrito.
 */
@Injectable()
export class CartaSuggestions {
  readonly #api = inject(PublicMenuApiService);
  readonly #cart = inject(CartaCart);
  readonly #analytics = inject(CartaAnalytics, { optional: true });
  readonly #browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly #menu = signal<PublicLocationMenuDto | null>(null);
  readonly #cache = new Map<string, readonly PublicSuggestionDto[]>();
  readonly #result = signal<Readonly<{ key: string; list: readonly PublicSuggestionDto[] }> | null>(null);
  /** Producto sugerido abierto en su detalle: al agregarlo cuenta como aceptado. */
  #pending: number | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #request: Subscription | null = null;

  /** Pide abrir el detalle de un producto sugerido (lo atiende la vista de la carta). */
  readonly detail = signal<PublicProductDto | null>(null);

  readonly #items = computed(() => {
    const seen = new Set<string>();
    const items: { productId: number; variationId: number }[] = [];
    for (const i of this.#cart.items()) {
      if (i.issue) continue;
      const k = `${i.line.productId}:${i.line.variationId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      items.push({ productId: i.line.productId, variationId: i.line.variationId });
    }
    return items.sort((a, b) => a.productId - b.productId || a.variationId - b.variationId).slice(0, MAX_ITEMS);
  });

  readonly #key = computed(() => {
    const m = this.#menu();
    const items = this.#items();
    if (!m || !items.length) return null;
    return `${m.business.slug}/${m.location.slug}|${items.map((i) => `${i.productId}:${i.variationId}`).join(',')}`;
  });

  readonly suggestions = computed<CartaSuggestion[]>(() => {
    const m = this.#menu();
    const key = this.#key();
    const result = this.#result();
    // Mientras llega la respuesta del carrito nuevo se mantienen las anteriores (sin parpadeo)
    if (!m || !key || !result || result.key.split('|')[0] !== key.split('|')[0]) return [];
    const byId = productsById(m);
    const blocked = blockedProducts(m);
    const inCart = new Set(this.#cart.items().map((i) => i.line.productId));
    const list: CartaSuggestion[] = [];
    for (const s of result.list) {
      const product = byId.get(s.productId);
      if (!product || blocked.has(product.id) || inCart.has(product.id) || list.some((x) => x.product.id === product.id)) continue;
      list.push({ product, message: s.message?.trim() || null, reason: s.reason });
      if (list.length >= MAX_SHOWN) break;
    }
    return list;
  });

  constructor() {
    effect(() => {
      const key = this.#key();
      const items = this.#items();
      const m = this.#menu();
      untracked(() => this.#schedule(key, items, m));
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.#timer) clearTimeout(this.#timer);
      this.#request?.unsubscribe();
    });
  }

  /** null: apagado (vista previa, sin pedidos o sin la función). */
  configure(menu: PublicLocationMenuDto | null): void {
    this.#menu.set(menu?.dynamic?.suggestionsEnabled ? menu : null);
  }

  shown(productId: number): void {
    this.#analytics?.trackOnce('suggestionShown', productId);
  }

  /** Agregar rápido (producto simple) o abrir el detalle. */
  choose(product: PublicProductDto): void {
    if (needsDetail(product)) {
      this.#pending = product.id;
      this.detail.set(product);
      return;
    }
    const variation = product.variations[0];
    if (!variation) return;
    const line = { productId: product.id, variationId: variation.id, quantity: 1 };
    if (!this.#cart.add({ name: product.name, details: [], unitPrice: variation.price, line })) return;
    this.#analytics?.track('add_to_cart', product.id);
    this.#analytics?.track('suggestionAccepted', product.id);
  }

  /** Producto agregado desde el detalle: si venía de una sugerencia, cuenta como aceptada. */
  added(productId: number): void {
    if (this.#pending !== productId) return;
    this.#pending = null;
    this.#analytics?.track('suggestionAccepted', productId);
  }

  #schedule(key: string | null, items: ReadonlyArray<{ productId: number; variationId: number }>, menu: PublicLocationMenuDto | null): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (!key || !menu || !this.#browser) return;
    const cached = this.#cache.get(key);
    if (cached) {
      this.#result.set({ key, list: cached });
      return;
    }
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#request?.unsubscribe();
      this.#request = this.#api.getSuggestions(menu.business.slug, menu.location.slug, items).subscribe({
        next: (res) => {
          const list = Array.isArray(res?.suggestions) ? res.suggestions.filter((s) => s && Number.isInteger(s.productId)) : [];
          this.#cache.set(key, list);
          this.#result.set({ key, list });
        },
        // Sin sugerencias: el pedido sigue igual
        error: () => this.#result.set({ key, list: [] }),
      });
    }, DEBOUNCE);
  }
}
