import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { catchError, forkJoin, map, of, Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaCart, ORDER_POLL_DELAY, orderStatus, OrderStatusView } from '../carta-cart';
import { CartaIcon } from './carta-icon';

/** "13:45" en la zona horaria del local. */
function formatOrderTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
}

const TONE_CLASS: Record<OrderStatusView['tone'], string> = {
  waiting: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  progress: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  done: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  bad: 'bg-muted text-foreground',
};

/**
 * "Tu pedido": estado del pedido (GET /orders/{id} cada 5 s), sus productos y el total del servidor. Deja de consultar
 * en los estados finales y mientras la pestaña no está visible. "Cancelar pedido" mientras está pendiente.
 */
@Component({
  selector: 'app-carta-order-tracking',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let o = order();
    <div class="px-5 pb-6 pt-5">
      <h2 class="pr-10 text-xl font-bold tracking-tight">Tu pedido</h2>
      @if (o) {
        <p class="mt-1 text-sm text-muted-foreground">
          @if (o.table) {
            {{ o.table.name }} ·
          }
          {{ time(o.createdAt) }}
          @if (o.customerName) {
            · a nombre de {{ o.customerName }}
          }
        </p>
      }

      <div aria-live="polite" class="mt-4">
        @if (status(); as s) {
          <p class="flex items-start gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold" [class]="toneClass[s.tone]">
            @if (!s.final && o?.status === 'pending') {
              <span class="relative mt-1.5 flex size-2.5 shrink-0" aria-hidden="true">
                <span class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none"></span>
                <span class="relative inline-flex size-2.5 rounded-full bg-current"></span>
              </span>
            } @else {
              <app-carta-icon [name]="s.tone === 'bad' ? 'info' : s.tone === 'done' ? 'check' : 'chef-hat'" [size]="18" class="mt-px" />
            }
            <span class="[overflow-wrap:anywhere]">{{ s.text }}</span>
          </p>
        } @else if (!error()) {
          <div class="h-12 animate-pulse rounded-2xl bg-muted" aria-label="Cargando el pedido"></div>
        }
        @if (error(); as e) {
          <p class="mt-2 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
            <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
            {{ e }}
          </p>
        }
        @if (notice(); as n) {
          <p class="mt-2 text-sm text-muted-foreground">{{ n }}</p>
        }
      </div>

      @if (o) {
        <ul class="mt-4 divide-y divide-border rounded-2xl border border-border" aria-label="Productos del pedido">
          @for (item of o.items; track $index) {
            <li class="flex items-start gap-3 px-4 py-3 text-sm">
              <span class="shrink-0 font-semibold tabular-nums">{{ item.quantity }} ×</span>
              <span class="min-w-0 flex-1">
                <span class="block font-medium [overflow-wrap:anywhere]">{{ item.name }}</span>
                @for (p of item.packItems; track $index) {
                  <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ p.quantity > 1 ? p.quantity + ' × ' : '' }}{{ p.name }}</span>
                }
                @for (mod of item.modifiers; track $index) {
                  <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]">+ {{ mod.quantity > 1 ? mod.quantity + ' × ' : '' }}{{ mod.name }}</span>
                }
                @if (item.note) {
                  <span class="block text-xs italic text-muted-foreground [overflow-wrap:anywhere]">"{{ item.note }}"</span>
                }
              </span>
              <span class="shrink-0 font-semibold tabular-nums">{{ format(item.total) }}</span>
            </li>
          }
        </ul>
        @if (o.note) {
          <p class="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]"><span class="font-semibold text-foreground">Nota:</span> {{ o.note }}</p>
        }
        <div class="mt-4 flex items-baseline justify-between gap-3">
          <span class="text-sm font-semibold">Total</span>
          <span class="text-lg font-bold tabular-nums">{{ format(o.total) }}</span>
        </div>

        @if (o.status === 'pending') {
          <div class="mt-5">
            @if (confirmCancel()) {
              <p class="text-sm font-medium">¿Quieres cancelar tu pedido?</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
                  [disabled]="cancelling()"
                  (click)="confirmCancel.set(false)"
                >
                  No
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-50"
                  [disabled]="cancelling()"
                  (click)="cancel()"
                >
                  {{ cancelling() ? 'Cancelando…' : 'Sí, cancelar' }}
                </button>
              </div>
            } @else {
              <button
                type="button"
                class="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
                (click)="confirmCancel.set(true)"
              >
                Cancelar pedido
              </button>
            }
          </div>
        }
      }

      <button type="button" class="mt-4 w-full rounded-full px-4 py-2.5 text-sm font-semibold text-primary underline-offset-4 hover:underline" (click)="back.emit()">
        Seguir viendo la carta
      </button>
    </div>
  `,
})
export class CartaOrderTracking implements OnInit {
  readonly orderId = input.required<string>();
  /** Respuesta del POST (evita la primera consulta). */
  readonly initial = input<PublicOrderDto | null>(null);
  readonly timeZone = input('America/Santiago');
  readonly back = output<void>();

  readonly #api = inject(PublicMenuApiService);
  readonly #cart = inject(CartaCart);

  protected readonly order = signal<PublicOrderDto | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly confirmCancel = signal(false);
  protected readonly status = computed(() => {
    const o = this.order();
    return o ? orderStatus(o) : null;
  });

  protected readonly format = formatMenuPrice;
  protected readonly toneClass = TONE_CLASS;
  protected readonly time = (iso: string) => formatOrderTime(iso, this.timeZone());

  #timer: ReturnType<typeof setTimeout> | null = null;
  #request: Subscription | null = null;
  #stopped = false;
  #destroyed = false;

  readonly #onVisibility = () => {
    if (document.visibilityState === 'hidden') this.#clearTimer();
    else if (!this.#stopped) this.#fetch();
  };

  constructor() {
    document.addEventListener('visibilitychange', this.#onVisibility);
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#clearTimer();
      this.#request?.unsubscribe();
      document.removeEventListener('visibilitychange', this.#onVisibility);
    });
  }

  ngOnInit(): void {
    const initial = this.initial();
    if (initial && initial.id === this.orderId()) {
      this.#apply(initial);
      this.#schedule();
    } else this.#fetch();
  }

  protected cancel(): void {
    if (this.cancelling()) return;
    this.cancelling.set(true);
    this.error.set(null);
    this.#clearTimer();
    this.#request?.unsubscribe();
    this.#request = this.#api.cancelOrder(this.orderId()).subscribe({
      next: (order) => {
        this.cancelling.set(false);
        this.confirmCancel.set(false);
        this.#apply(order);
      },
      error: (e) => {
        this.cancelling.set(false);
        this.confirmCancel.set(false);
        const api = readApiError(e);
        if (api.code === 'CUSTOMER_ORDER_NOT_PENDING') {
          this.notice.set('El local ya respondió tu pedido.');
        } else if (api.status === 0) this.error.set('No hay conexión. Revisa tu internet');
        else if (api.code === 'RATE_LIMITED' || api.status === 429) this.error.set('Demasiados intentos, espera un minuto');
        else this.error.set(api.message || 'No pudimos cancelar el pedido. Intenta de nuevo');
        this.#fetch();
      },
    });
  }

  #apply(order: PublicOrderDto): void {
    this.order.set(order);
    if (orderStatus(order).final) {
      this.#stopped = true;
      this.#clearTimer();
    }
  }

  #fetch(): void {
    if (this.#destroyed) return;
    this.#clearTimer();
    this.#request?.unsubscribe();
    this.#request = this.#api.getOrder(this.orderId()).subscribe({
      next: (order) => {
        this.error.set(null);
        this.#apply(order);
        this.#schedule();
      },
      error: (e) => {
        const api = readApiError(e);
        if (api.status === 404) {
          this.#stopped = true;
          this.error.set('No encontramos este pedido');
          this.#cart.forgetOrder(this.orderId());
          return;
        }
        this.error.set(api.status === 0 ? 'Sin conexión. Reintentaremos en unos segundos' : 'No pudimos actualizar el estado. Reintentaremos en unos segundos');
        this.#schedule();
      },
    });
  }

  #schedule(): void {
    this.#clearTimer();
    if (this.#stopped || this.#destroyed || document.visibilityState === 'hidden') return;
    this.#timer = setTimeout(() => this.#fetch(), ORDER_POLL_DELAY);
  }

  #clearTimer(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

/** Los más recientes (una consulta por pedido). */
const MAX_LISTED = 8;

type OrderRow = Readonly<{ id: string; order: PublicOrderDto | null }>;

/** "Mis pedidos": los pedidos de esta mesa guardados en el dispositivo (el más nuevo primero). */
@Component({
  selector: 'app-carta-my-orders',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-5 pb-6 pt-5">
      <h2 class="pr-10 text-xl font-bold tracking-tight">Mis pedidos</h2>
      @if (rows(); as list) {
        @if (list.length) {
          <ul class="mt-4 grid gap-2">
            @for (row of list; track row.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-primary"
                  (click)="open.emit(row.id)"
                >
                  <app-carta-icon name="receipt" [size]="20" class="text-muted-foreground" />
                  <span class="min-w-0 flex-1">
                    @if (row.order; as o) {
                      <span class="block text-sm font-semibold">Pedido de las {{ time(o.createdAt) }} · {{ format(o.total) }}</span>
                      <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ statusText(o) }}</span>
                    } @else {
                      <span class="block text-sm font-semibold">Pedido</span>
                      <span class="block text-xs text-muted-foreground">No pudimos cargar su estado</span>
                    }
                  </span>
                  <app-carta-icon name="chevron-right" [size]="18" class="text-muted-foreground" />
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="py-10 text-center text-sm text-muted-foreground">Aún no has hecho pedidos desde esta mesa.</p>
        }
      } @else {
        <div class="mt-4 grid gap-2" aria-busy="true" aria-label="Cargando tus pedidos">
          @for (i of [1, 2]; track i) {
            <div class="h-16 animate-pulse rounded-2xl bg-muted"></div>
          }
        </div>
      }
    </div>
  `,
})
export class CartaMyOrders implements OnInit {
  readonly ids = input.required<readonly string[]>();
  readonly timeZone = input('America/Santiago');
  readonly open = output<string>();

  readonly #api = inject(PublicMenuApiService);
  readonly #cart = inject(CartaCart);
  readonly #destroyRef = inject(DestroyRef);

  protected readonly rows = signal<OrderRow[] | null>(null);
  protected readonly format = formatMenuPrice;
  protected readonly time = (iso: string) => formatOrderTime(iso, this.timeZone());
  protected readonly statusText = (o: PublicOrderDto) => orderStatus(o).text;

  ngOnInit(): void {
    const ids = this.ids().slice(0, MAX_LISTED);
    if (!ids.length) {
      this.rows.set([]);
      return;
    }
    const sub = forkJoin(
      ids.map((id) =>
        this.#api.getOrder(id).pipe(
          map((order): OrderRow | null => ({ id, order })),
          catchError((e) => {
            // 404: el pedido ya no existe; se olvida
            if (readApiError(e).status === 404) {
              this.#cart.forgetOrder(id);
              return of(null);
            }
            return of<OrderRow>({ id, order: null });
          }),
        ),
      ),
    ).subscribe((rows) => this.rows.set(rows.filter((r): r is OrderRow => !!r)));
    this.#destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
