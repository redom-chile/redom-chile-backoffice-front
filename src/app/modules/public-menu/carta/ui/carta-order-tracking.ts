import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { catchError, forkJoin, map, of, Subscription } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { RouterLink } from '@angular/router';
import { CartaCart, ONLINE_ORDER_POLL_DELAY, ORDER_POLL_DELAY, orderStatus, OrderStatusView } from '../carta-cart';
import { CHANNEL_LABELS, formatScheduled, PAYMENT_LABELS } from '../carta-online';
import { phoneUrl } from '../carta-utils';
import { CartaEmbed } from '../carta-embed';
import { CartaI18n, cartaErrorMessage, cartaLocale, ct, ctn } from '../carta-i18n';
import { CartaIcon } from './carta-icon';
import { CartaOrderFeedback } from './carta-order-feedback';
import { CartaOrderReceipt } from './carta-order-receipt';

/** "13:45" en la zona horaria del local. */
function formatOrderTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(cartaLocale(), { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(cartaLocale(), { hour: '2-digit', minute: '2-digit' }).format(date);
  }
}

const TONE_CLASS: Record<OrderStatusView['tone'], string> = {
  waiting: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  progress: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
  done: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  bad: 'bg-muted text-foreground',
};

const isOnline = (o: PublicOrderDto | null) => o?.channel === 'pickup' || o?.channel === 'delivery';

/**
 * "Tu pedido": estado del pedido (GET /orders/{id} cada 5 s; retiro y delivery cada 10 s), sus productos y el total
 * del servidor. Deja de consultar en los estados finales y mientras la pestaña no está visible. "Cancelar pedido"
 * mientras está pendiente (en una transferencia, hasta que se sube el comprobante). Retiro y delivery (etapa 5):
 * local, entrega, hora programada, método de pago, envío y la transferencia con comprobante.
 */
@Component({
  selector: 'app-carta-order-tracking',
  imports: [CartaIcon, CartaOrderFeedback, CartaOrderReceipt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let o = order();
    @let online = isOnline(o);
    <div class="px-5 pb-6 pt-5">
      @if (standalone()) {
        <h1 class="text-2xl font-bold tracking-tight">{{ t('tracking.title') }}</h1>
      } @else {
        <h2 class="pr-10 text-xl font-bold tracking-tight">{{ t('tracking.title') }}</h2>
      }
      @if (o) {
        <p class="mt-1 text-sm text-muted-foreground">
          @if (o.table) {
            {{ o.table.name }} ·
          }
          @if (online && o.channel) {
            {{ channelLabel(o) }} ·
          }
          {{ time(o.createdAt) }}
          @if (o.customerName) {
            · {{ t('tracking.forName', { name: o.customerName }) }}
          }
        </p>
      }

      <div aria-live="polite" class="mt-4">
        @if (status(); as s) {
          <p class="flex items-start gap-3 rounded-2xl px-4 py-3 text-[0.9375rem] font-semibold" [class]="toneClass[s.tone]">
            @if (!s.final && o?.status === 'pending') {
              <span class="relative mt-1.5 flex size-2.5 shrink-0" aria-hidden="true">
                <span class="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none"></span>
                <span class="relative inline-flex size-2.5 rounded-full bg-current"></span>
              </span>
            } @else {
              <app-carta-icon
                [name]="s.tone === 'bad' ? 'info' : s.tone === 'done' ? 'check' : o?.fulfillment === 'on_the_way' ? 'truck' : 'chef-hat'"
                [size]="18"
                class="mt-px"
              />
            }
            <span class="min-w-0 flex-1">
              <span class="block [overflow-wrap:anywhere]">{{ s.text }}</span>
              @if (online && o) {
                @if (o.status === 'accepted' && o.fulfillment === 'ready' && o.channel === 'pickup' && o.location?.address) {
                  <span class="mt-0.5 block text-sm font-medium [overflow-wrap:anywhere]">{{ t('tracking.pickupAt', { address: o.location.address }) }}</span>
                } @else if ((o.status === 'pending' || o.status === 'accepted') && !o.fulfillment && o.scheduledFor) {
                  <span class="mt-0.5 block text-sm font-medium">{{ t('tracking.scheduledFor', { when: scheduled(o.scheduledFor) }) }}</span>
                }
              }
            </span>
          </p>
        } @else if (!error()) {
          <div class="h-12 animate-pulse rounded-2xl bg-muted" [attr.aria-label]="t('tracking.loading')"></div>
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

      @if (o && o.status === 'pending' && o.paymentStatus === 'awaiting_receipt') {
        <app-carta-order-receipt class="mt-4" [order]="o" (updated)="onReceipt($event)" (refresh)="refreshNow()" />
      }

      @if (o && (askFeedback() || feedbackSent())) {
        <!-- Encuesta (etapa 4): entregado o cerrado y sin respuesta -->
        <app-carta-order-feedback class="mt-4" [orderId]="o.id" (sent)="feedbackSent.set(true)" />
      } @else if (o?.feedback; as f) {
        <p class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span class="flex text-amber-500" aria-hidden="true">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <app-carta-icon name="star" [size]="16" [filled]="n <= f.rating" />
            }
          </span>
          <span><span class="sr-only">{{ t('tracking.ratedSr', { rating: f.rating }) }}</span>{{ t('tracking.thanks') }}</span>
        </p>
      }

      @if (online && loyalty(); as l) {
        <!-- Fidelización: solo el saldo; se canjea en la caja -->
        <div class="mt-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm" role="note">
          <app-carta-icon name="star" [size]="18" class="mt-px shrink-0 text-primary" />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold [overflow-wrap:anywhere]">{{ l.text }}</span>
            <span class="mt-0.5 block text-muted-foreground">{{ t('tracking.loyaltyHint') }}</span>
          </span>
        </div>
      }

      @if (o && online) {
        <dl class="mt-4 grid gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          @if (o.location; as l) {
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('tracking.location') }}</dt>
              <dd class="min-w-0 text-right">
                <span class="block font-semibold [overflow-wrap:anywhere]">{{ l.name }}</span>
                @if (l.phone) {
                  <a [href]="tel(l.phone)" class="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                    <app-carta-icon name="phone" [size]="14" />
                    {{ l.phone }}
                  </a>
                }
              </dd>
            </div>
          }
          @if (o.channel === 'delivery' && o.address; as a) {
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('tracking.deliverTo') }}</dt>
              <dd class="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">
                {{ a.street }}{{ a.number ? ' ' + a.number : '' }}{{ a.details ? ', ' + a.details : '' }}, {{ a.communeName }}
              </dd>
            </div>
          } @else if (o.channel === 'pickup' && o.location?.address) {
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('tracking.pickupIn') }}</dt>
              <dd class="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{{ o.location.address }}</dd>
            </div>
          }
          @if (o.scheduledFor) {
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('tracking.for') }}</dt>
              <dd class="text-right font-semibold first-letter:uppercase">{{ scheduled(o.scheduledFor) }}</dd>
            </div>
          }
          @if (o.paymentMethod) {
            <div class="flex items-start justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('tracking.payment') }}</dt>
              <dd class="text-right font-semibold">{{ paymentLabels[o.paymentMethod] }}</dd>
            </div>
          }
        </dl>
      }

      @if (o) {
        <ul class="mt-4 divide-y divide-border rounded-2xl border border-border" [attr.aria-label]="t('tracking.items')">
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
          <p class="mt-3 text-sm text-muted-foreground [overflow-wrap:anywhere]"><span class="font-semibold text-foreground">{{ t('tracking.note') }}</span> {{ o.note }}</p>
        }
        @if (o.channel === 'delivery') {
          <div class="mt-4 flex items-baseline justify-between gap-3 text-sm">
            <span class="text-muted-foreground">{{ t('tracking.deliveryFee') }}</span>
            <span class="font-semibold tabular-nums">{{ o.deliveryFee ? format(o.deliveryFee) : t('tracking.free') }}</span>
          </div>
        }
        <div class="flex items-baseline justify-between gap-3" [class]="o.channel === 'delivery' ? 'mt-1' : 'mt-4'">
          <span class="text-sm font-semibold">{{ t('tracking.total') }}</span>
          <span class="text-lg font-bold tabular-nums">{{ format(o.total) }}</span>
        </div>

        @if (o.status === 'pending' && o.paymentStatus !== 'to_verify') {
          <div class="mt-5">
            @if (confirmCancel()) {
              <p class="text-sm font-medium">{{ t('tracking.cancelConfirm') }}</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
                  [disabled]="cancelling()"
                  (click)="confirmCancel.set(false)"
                >
                  {{ t('tracking.no') }}
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-50"
                  [disabled]="cancelling()"
                  (click)="cancel()"
                >
                  {{ cancelling() ? t('tracking.cancelling') : t('tracking.yesCancel') }}
                </button>
              </div>
            } @else {
              <button
                type="button"
                class="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
                (click)="confirmCancel.set(true)"
              >
                {{ t('tracking.cancel') }}
              </button>
            }
          </div>
        }
      }

      @if (backText(); as label) {
        <button type="button" class="mt-4 w-full rounded-full px-4 py-2.5 text-sm font-semibold text-primary underline-offset-4 hover:underline" (click)="back.emit()">
          {{ label }}
        </button>
      }
    </div>
  `,
})
export class CartaOrderTracking implements OnInit {
  readonly orderId = input.required<string>();
  /** Respuesta del POST (evita la primera consulta). */
  readonly initial = input<PublicOrderDto | null>(null);
  readonly timeZone = input('America/Santiago');
  /** Página propia (/carta/pedido/{id}): título h1. */
  readonly standalone = input(false);
  /** null: sin el botón para volver. */
  /** undefined: "Seguir viendo la carta" en el idioma de la carta. */
  readonly backLabel = input<string | null | undefined>(undefined);
  readonly back = output<void>();

  readonly #api = inject(PublicMenuApiService);
  /** No está en la página de seguimiento (sin carta). */
  readonly #cart = inject(CartaCart, { optional: true });

  protected readonly order = signal<PublicOrderDto | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly cancelling = signal(false);
  protected readonly confirmCancel = signal(false);
  /** Encuesta: entregado o cerrado y sin feedback. Tras enviarla se mantiene visible (para el botón de Google). */
  protected readonly feedbackSent = signal(false);
  protected readonly askFeedback = computed(() => {
    const o = this.order();
    return !!o && (o.progress === 'delivered' || o.progress === 'completed') && o.feedback == null;
  });
  protected readonly status = computed(() => {
    const o = this.order();
    return o ? orderStatus(o) : null;
  });

  protected readonly t = inject(CartaI18n).t;
  protected readonly backText = computed(() => {
    const label = this.backLabel();
    return label === undefined ? ct('tracking.back') : label;
  });
  /** "Tienes 120 puntos en Club Café". */
  protected readonly loyalty = computed(() => {
    const l = this.order()?.loyalty;
    if (!l) return null;
    const balance = new Intl.NumberFormat(cartaLocale()).format(l.balance);
    const key = l.mechanic === 'stamps' ? 'tracking.loyaltyStamps' : 'tracking.loyaltyPoints';
    return { text: ctn(key, l.balance, { balance, program: l.programName }) };
  });

  protected readonly format = formatMenuPrice;
  protected readonly toneClass = TONE_CLASS;
  protected readonly time = (iso: string) => formatOrderTime(iso, this.timeZone());
  protected readonly scheduled = (iso: string) => formatScheduled(iso, this.timeZone());
  protected readonly isOnline = isOnline;
  protected readonly channelLabel = (o: PublicOrderDto) => (o.channel === 'pickup' || o.channel === 'delivery' ? CHANNEL_LABELS[o.channel] : '');
  protected readonly paymentLabels = PAYMENT_LABELS;
  protected readonly tel = phoneUrl;

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

  protected onReceipt(order: PublicOrderDto): void {
    this.notice.set(ct('tracking.receiptReceived'));
    this.#apply(order);
    this.#schedule();
  }

  protected refreshNow(): void {
    if (!this.#stopped) this.#fetch();
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
          this.notice.set(ct('tracking.alreadyAnswered'));
        } else if (api.status === 0) this.error.set(ct('tracking.offline'));
        else if (api.code === 'RATE_LIMITED' || api.status === 429) this.error.set(ct('tracking.tooMany'));
        else this.error.set(cartaErrorMessage(e, ct('tracking.cancelFailed')));
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
          this.error.set(ct('tracking.notFound'));
          this.#cart?.forgetOrder(this.orderId());
          return;
        }
        this.error.set(ct(api.status === 0 ? 'tracking.offlineRetry' : 'tracking.updateFailed'));
        this.#schedule();
      },
    });
  }

  #schedule(): void {
    this.#clearTimer();
    if (this.#stopped || this.#destroyed || document.visibilityState === 'hidden') return;
    this.#timer = setTimeout(() => this.#fetch(), isOnline(this.order()) ? ONLINE_ORDER_POLL_DELAY : ORDER_POLL_DELAY);
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
  imports: [CartaIcon, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="px-5 pb-6 pt-5">
      <h2 class="pr-10 text-xl font-bold tracking-tight">{{ t('tracking.myOrders') }}</h2>
      @if (rows(); as list) {
        @if (list.length) {
          <ul class="mt-4 grid gap-2">
            @for (row of list; track row.id) {
              <li>
                <ng-template #rowContent>
                  <app-carta-icon [name]="row.order?.channel === 'delivery' ? 'truck' : row.order?.channel === 'pickup' ? 'store' : 'receipt'" [size]="20" class="text-muted-foreground" />
                  <span class="min-w-0 flex-1">
                    @if (row.order; as o) {
                      <span class="block text-sm font-semibold">{{ rowTitle(o.createdAt) }} · {{ format(o.total) }}</span>
                      <span class="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{{ statusText(o) }}</span>
                    } @else {
                      <span class="block text-sm font-semibold">{{ t('tracking.row') }}</span>
                      <span class="block text-xs text-muted-foreground">{{ t('tracking.rowFailed') }}</span>
                    }
                  </span>
                  <app-carta-icon name="chevron-right" [size]="18" class="text-muted-foreground" />
                </ng-template>
                @if (linkBase(); as base) {
                  <a [routerLink]="base + '/' + row.id" [queryParams]="embedParams" [state]="linkState() ?? {}" [class]="rowClass">
                    <ng-container [ngTemplateOutlet]="rowContent" />
                  </a>
                } @else {
                  <button type="button" [class]="rowClass" (click)="open.emit(row.id)">
                    <ng-container [ngTemplateOutlet]="rowContent" />
                  </button>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="py-10 text-center text-sm text-muted-foreground">{{ emptyText() ?? t('tracking.emptyTable') }}</p>
        }
      } @else {
        <div class="mt-4 grid gap-2" aria-busy="true" [attr.aria-label]="t('tracking.loadingOrders')">
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
  /** Retiro / delivery: cada fila enlaza a {linkBase}/{id} (la página de seguimiento) en vez de emitir (open). */
  readonly linkBase = input<string | null>(null);
  readonly linkState = input<Record<string, unknown> | null>(null);
  /** ?embed=1 se conserva al abrir el seguimiento. */
  protected readonly embedParams = inject(CartaEmbed).queryParams;
  /** undefined: "Aún no has hecho pedidos desde esta mesa." en el idioma de la carta. */
  readonly emptyText = input<string | undefined>(undefined);
  readonly open = output<string>();

  readonly #api = inject(PublicMenuApiService);
  readonly #cart = inject(CartaCart);
  protected readonly rowClass =
    'flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left text-foreground transition hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-primary';
  readonly #destroyRef = inject(DestroyRef);

  protected readonly rows = signal<OrderRow[] | null>(null);
  protected readonly format = formatMenuPrice;
  protected readonly t = inject(CartaI18n).t;
  protected readonly statusText = (o: PublicOrderDto) => orderStatus(o).text;
  /** "Pedido de las 13:45"; de otro día (retiro / delivery): "Pedido del 12/10 a las 13:45". */
  protected readonly rowTitle = (iso: string) => {
    const time = formatOrderTime(iso, this.timeZone());
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return ct('tracking.rowToday', { time });
    const fmt = (date: Date) => {
      try {
        return new Intl.DateTimeFormat(cartaLocale(), { day: '2-digit', month: '2-digit', timeZone: this.timeZone() }).format(date);
      } catch {
        return new Intl.DateTimeFormat(cartaLocale(), { day: '2-digit', month: '2-digit' }).format(date);
      }
    };
    const value = fmt(d);
    return value === fmt(new Date()) ? ct('tracking.rowToday', { time }) : ct('tracking.rowOtherDay', { date: value, time });
  };

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
