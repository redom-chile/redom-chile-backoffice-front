import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Observable, Subscription, tap } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { TableRequestDto, TableRequestType } from '../data-access/dtos/table-service.dto';
import { PublicMenuApiService } from '../data-access/public-menu-api.service';

/** GET /tables/{qr}/requests mientras haya alguna abierta. */
export const TABLE_REQUESTS_POLL_DELAY = 10_000;
/** Nota de la solicitud (backend: ≤ 200). */
export const MAX_TABLE_REQUEST_NOTE = 200;
/** "El mesero va en camino" se oculta solo después de este tiempo. */
const ATTENDED_NOTICE_MS = 60_000;

/** "13:45" en la zona horaria del local. */
export function formatClock(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
}

/** Errores del servicio en la mesa (403 TABLE_REQUESTS_DISABLED, 404 MENU_NOT_FOUND, 429 RATE_LIMITED). */
export function readTableServiceError(
  error: unknown,
  fallback = 'No pudimos avisar al mesero. Intenta de nuevo',
): Readonly<{ message: string; disabled: boolean; notFound: boolean }> {
  const api = readApiError(error);
  if (api.code === 'TABLE_REQUESTS_DISABLED' || api.status === 403)
    return { message: 'Esta mesa no puede llamar al mesero desde la carta', disabled: true, notFound: false };
  if (api.code === 'MENU_NOT_FOUND' || api.status === 404)
    return { message: 'El código QR de esta mesa ya no es válido. Pide al mesero el nuevo', disabled: false, notFound: true };
  if (api.code === 'RATE_LIMITED' || api.status === 429) return { message: 'Demasiados intentos, espera un minuto', disabled: false, notFound: false };
  if (api.status === 0) return { message: 'No hay conexión. Revisa tu internet', disabled: false, notFound: false };
  return { message: api.message || fallback, disabled: false, notFound: false };
}

export type TableServiceStatus = Readonly<{ id: number; tone: 'open' | 'attended'; text: string }>;

/**
 * Llamar al mesero y pedir la cuenta (etapa 4): solicitudes de la mesa con su estado. Consulta cada 10 s mientras
 * haya alguna abierta (no mientras la pestaña está oculta). La provee CartaMenuView; se activa con start(qr).
 */
@Injectable()
export class CartaTableService {
  readonly #api = inject(PublicMenuApiService);

  /** Solicitudes de la mesa (abiertas y atendidas en los últimos 15 minutos), la más nueva primero. */
  readonly requests = signal<readonly TableRequestDto[]>([]);
  /** 403 TABLE_REQUESTS_DISABLED o 404: se ocultan los botones. */
  readonly unavailable = signal(false);
  readonly #dismissed = signal<ReadonlySet<number>>(new Set());

  readonly #qr = signal<string | null>(null);
  readonly #timeZone = signal('America/Santiago');
  readonly active = computed(() => !!this.#qr() && !this.unavailable());

  /** La abierta más nueva de cada tipo. */
  readonly openCall = computed(() => this.#openOf('call_waiter'));
  readonly openBill = computed(() => this.#openOf('request_bill'));
  readonly hasOpen = computed(() => this.requests().some((r) => r.status === 'open'));

  /** Lo que se muestra al cliente: la abierta más nueva o, si no hay, la recién atendida. */
  readonly status = computed<TableServiceStatus | null>(() => {
    const list = this.requests();
    const dismissed = this.#dismissed();
    const open = list.find((r) => r.status === 'open');
    if (open && !dismissed.has(open.id)) {
      const time = formatClock(open.createdAt, this.#timeZone());
      return {
        id: open.id,
        tone: 'open',
        text: open.type === 'request_bill' ? `Pediste la cuenta a las ${time}. Ya avisamos al mesero` : `Ya avisamos al mesero (${time})`,
      };
    }
    if (open) return null;
    const attended = list.find((r) => r.status === 'attended');
    return attended && !dismissed.has(attended.id) ? { id: attended.id, tone: 'attended', text: 'El mesero va en camino' } : null;
  });

  #timer: ReturnType<typeof setTimeout> | null = null;
  #poll: Subscription | null = null;
  #destroyed = false;
  #listening = false;
  readonly #hideTimers = new Set<ReturnType<typeof setTimeout>>();

  readonly #onVisibility = () => {
    if (document.visibilityState === 'hidden') this.#clearTimer();
    else if (this.hasOpen()) this.#fetch();
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#clearTimer();
      this.#poll?.unsubscribe();
      this.#hideTimers.forEach(clearTimeout);
      if (this.#listening) document.removeEventListener('visibilitychange', this.#onVisibility);
    });
  }

  /** Solo en el navegador. Carga las solicitudes de la mesa (por si el cliente recargó la página). */
  start(qr: string, timeZone: string): void {
    this.#timeZone.set(timeZone);
    if (this.#qr() === qr) return;
    this.#qr.set(qr);
    this.unavailable.set(false);
    this.requests.set([]);
    if (!this.#listening) {
      document.addEventListener('visibilitychange', this.#onVisibility);
      this.#listening = true;
    }
    this.#fetch(true);
  }

  /** Si ya hay una abierta del mismo tipo, el backend devuelve esa misma. */
  send(type: TableRequestType, note?: string): Observable<TableRequestDto> {
    const qr = this.#qr();
    if (!qr) throw new Error('Sin QR de mesa');
    const trimmed = note?.trim();
    return this.#api.createTableRequest(qr, trimmed ? { type, note: trimmed } : { type }).pipe(
      tap({
        next: (request) => {
          this.requests.update((list) => [request, ...list.filter((r) => r.id !== request.id)]);
          this.#undismiss(request.id);
          this.#schedule();
        },
        error: (e) => this.#onError(e),
      }),
    );
  }

  dismiss(id: number): void {
    this.#dismissed.update((set) => new Set(set).add(id));
  }

  #openOf(type: TableRequestType): TableRequestDto | null {
    return this.requests().find((r) => r.status === 'open' && r.type === type) ?? null;
  }

  #undismiss(id: number): void {
    if (!this.#dismissed().has(id)) return;
    this.#dismissed.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  #fetch(initial = false): void {
    const qr = this.#qr();
    if (!qr || this.#destroyed || this.unavailable()) return;
    this.#clearTimer();
    this.#poll?.unsubscribe();
    this.#poll = this.#api.getTableRequests(qr).subscribe({
      next: (list) => {
        const before = new Map(this.requests().map((r) => [r.id, r.status] as const));
        // Las atendidas antes de abrir la carta no se anuncian
        if (initial) list.filter((r) => r.status === 'attended').forEach((r) => this.dismiss(r.id));
        else {
          for (const r of list) {
            if (r.status === 'attended' && before.get(r.id) === 'open') this.#autoHide(r.id);
          }
        }
        this.requests.set(list);
        this.#schedule();
      },
      error: (e) => {
        this.#onError(e);
        this.#schedule();
      },
    });
  }

  #onError(error: unknown): void {
    const e = readTableServiceError(error);
    if (e.disabled || e.notFound) {
      this.unavailable.set(true);
      this.#clearTimer();
    }
  }

  #autoHide(id: number): void {
    const timer = setTimeout(() => {
      this.#hideTimers.delete(timer);
      this.dismiss(id);
    }, ATTENDED_NOTICE_MS);
    this.#hideTimers.add(timer);
  }

  #schedule(): void {
    this.#clearTimer();
    if (this.#destroyed || this.unavailable() || !this.hasOpen() || document.visibilityState === 'hidden') return;
    this.#timer = setTimeout(() => this.#fetch(), TABLE_REQUESTS_POLL_DELAY);
  }

  #clearTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
