import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MenuEventsRequestDto, MenuEventType } from '../data-access/dtos/menu-marketing.dto';
import { PublicMenuApiService } from '../data-access/public-menu-api.service';

/** Etapa 11: eventos de la carta dinámica (el backend los acepta desde esa etapa). */
export type CartaEventType = MenuEventType | 'suggestionShown' | 'suggestionAccepted' | 'dailySpecialView';

type MenuEvent = Readonly<{ type: CartaEventType; refId?: number }>;

const SESSION_KEY = 'redom-menu-session';
const BATCH_SIZE = 20;
const FLUSH_DELAY = 5000;

/** Id aleatorio de la visita (sin datos personales). Sin almacenamiento, uno por carga de página. */
function sessionId(): string | undefined {
  const create = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
  };
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id || id.length > 64) {
      id = create();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return create();
  }
}

/**
 * Analítica de la carta pública: junta los eventos y los envía por lotes de hasta 20 cada ~5 s y al salir
 * (sendBeacon, o fetch con keepalive). Ante cualquier error descarta el lote sin reintentar. Solo en el navegador.
 * Se provee en la página de la carta (la vista previa del backoffice no la tiene y no envía nada).
 */
@Injectable()
export class CartaAnalytics {
  readonly #api = inject(PublicMenuApiService);
  readonly #browser = isPlatformBrowser(inject(PLATFORM_ID));

  #context: Readonly<{ businessSlug: string; locationSlug: string }> | null = null;
  #sessionId: string | undefined;
  #queue: MenuEvent[] = [];
  #once = new Set<string>();
  #timer: ReturnType<typeof setTimeout> | null = null;

  readonly #onPageHide = () => this.flush(true);
  readonly #onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush(true);
  };

  constructor() {
    if (!this.#browser) return;
    addEventListener('pagehide', this.#onPageHide);
    document.addEventListener('visibilitychange', this.#onVisibility);
    inject(DestroyRef).onDestroy(() => {
      this.flush(false);
      removeEventListener('pagehide', this.#onPageHide);
      document.removeEventListener('visibilitychange', this.#onVisibility);
    });
  }

  /** Carta abierta (o recargada). Los eventos pendientes de otra carta se envían antes. */
  start(businessSlug: string, locationSlug: string): void {
    if (!this.#browser) return;
    const ctx = this.#context;
    if (ctx && (ctx.businessSlug !== businessSlug || ctx.locationSlug !== locationSlug)) {
      this.flush(false);
      this.#once.clear();
    }
    this.#context = { businessSlug, locationSlug };
    this.#sessionId ??= sessionId();
  }

  track(type: CartaEventType, refId?: number): void {
    if (!this.#browser || !this.#context) return;
    this.#queue.push(refId == null ? { type } : { type, refId });
    if (this.#queue.length >= BATCH_SIZE) this.flush(false);
    else this.#timer ??= setTimeout(() => this.flush(false), FLUSH_DELAY);
  }

  /** Una vez por carta abierta (p. ej. banner_view). */
  trackOnce(type: CartaEventType, refId?: number): void {
    const key = `${type}:${refId ?? ''}`;
    if (this.#once.has(key)) return;
    this.#once.add(key);
    this.track(type, refId);
  }

  flush(leaving: boolean): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    const ctx = this.#context;
    if (!ctx) return;
    while (this.#queue.length) {
      const dto: MenuEventsRequestDto = { ...ctx, sessionId: this.#sessionId, events: this.#queue.splice(0, BATCH_SIZE) as MenuEventsRequestDto['events'] };
      try {
        if (leaving) this.#beacon(dto);
        else this.#api.sendEvents(dto).subscribe({ error: () => undefined });
      } catch {
        // Se descarta el lote
      }
    }
  }

  #beacon(dto: MenuEventsRequestDto): void {
    const url = this.#api.eventsUrl();
    const body = JSON.stringify(dto);
    try {
      if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
    } catch {
      // Sin sendBeacon: fetch con keepalive
    }
    void fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  }
}
