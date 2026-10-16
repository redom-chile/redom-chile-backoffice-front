import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerOrderDto, formatMenuPrice, OrderFulfillment } from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, IconComponent } from 'src/ui';
import {
  CHANNEL_ICONS,
  CHANNEL_LABELS,
  channelOf,
  CUSTOMER_ORDER_STATUS_LABELS,
  formatElapsed,
  formatOrderDate,
  formatScheduled,
  FULFILLMENT_ACTIONS,
  FULFILLMENT_LABELS,
  isPdfUrl,
  nextFulfillmentSteps,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS,
  tableLabel,
  whatsappUrl,
} from './customer-order-format';

// Minutos de espera desde los que el pendiente se destaca.
const LATE_MINUTES = 5;

const STATUS_CLASSES = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  accepted: 'bg-green-500/15 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400',
  cancelled: 'bg-muted/40 text-muted-foreground',
} as const;

const withoutQuery = (url: string) => url.split('?')[0];

export type FulfillmentRequest = Readonly<{ order: CustomerOrderDto; status: OrderFulfillment }>;

/** Un pedido de cliente (mesa, retiro o delivery): cliente, entrega, pago, productos y las acciones que correspondan. */
@Component({
  selector: 'app-customer-order-card',
  imports: [RouterLink, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = order();
    @let channel = $channel();
    <article class="glass flex flex-col gap-3 rounded-[1rem] p-4" [class.ring-2]="$isLate()" [class.ring-amber-500]="$isLate()">
      <header class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-2">
          <span
            class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            [class]="channel === 'table' ? 'bg-muted/50 text-foreground' : 'bg-primary/10 text-primary'"
            [attr.title]="channelLabels[channel]">
            <app-icon class="h-[18px] w-[18px]" aria-hidden="true">{{ channelIcons[channel] }}</app-icon>
          </span>
          <div class="min-w-0">
            <h3 class="text-foreground truncate text-lg font-semibold">{{ channel === 'table' ? $table() : channelLabels[channel] }}</h3>
            <p class="text-muted-foreground text-xs">
              @if (o.status === 'pending') {
              <span [class]="$isLate() ? 'font-semibold text-amber-700 dark:text-amber-400' : ''">{{ $elapsed() }}</span>
              } @else {
              {{ $date() }}
              }
              @if (o.customerName) {
              · <span class="text-foreground font-medium">{{ o.customerName }}</span>
              }
            </p>
          </div>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          @if (o.status !== 'pending') {
          <span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="statusClasses[o.status]">{{ statusLabels[o.status] }}</span>
          }
          @if (o.status === 'accepted' && channel !== 'table') {
          <span class="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
            {{ o.fulfillment ? fulfillmentLabels[o.fulfillment] : 'En preparación' }}
          </span>
          }
          @if (o.autoAccepted) {
          <span class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
            <app-icon class="h-3 w-3" aria-hidden="true">bolt</app-icon>Automático
          </span>
          }
        </div>
      </header>

      @if (channel !== 'table') {
      <div class="glass-row flex flex-col gap-1.5 rounded-xl px-3 py-2 text-sm">
        @if (o.scheduledFor) {
        <p class="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300">
          <app-icon class="h-4 w-4" aria-hidden="true">schedule</app-icon>Programado para {{ $scheduled() }}
        </p>
        }
        @if (o.customerPhone) {
        <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a [href]="'tel:' + o.customerPhone" class="text-primary inline-flex items-center gap-1 font-medium hover:underline">
            <app-icon class="h-4 w-4" aria-hidden="true">call</app-icon>{{ o.customerPhone }}
          </a>
          @if ($whatsapp(); as url) {
          <a [href]="url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-medium text-green-700 hover:underline dark:text-green-400">
            <app-icon class="h-4 w-4" aria-hidden="true">chat</app-icon>WhatsApp
          </a>
          }
        </p>
        }
        @if (o.address; as address) {
        <p class="text-foreground flex items-start gap-1.5">
          <app-icon class="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">location_on</app-icon>
          <span class="min-w-0">
            {{ address.street }}{{ address.number ? ' ' + address.number : '' }}{{ address.details ? ', ' + address.details : '' }},
            <span class="font-medium">{{ address.communeName }}</span>
            @if (address.latitude != null && address.longitude != null) {
            <a [href]="mapUrl(address.latitude, address.longitude)" target="_blank" rel="noopener" class="text-primary ml-1 text-xs font-medium hover:underline">Mapa</a>
            }
          </span>
        </p>
        }
        @if (o.paymentMethod) {
        <p class="flex flex-wrap items-center gap-2">
          <span class="text-foreground inline-flex items-center gap-1.5">
            <app-icon class="text-muted-foreground h-4 w-4" aria-hidden="true">payments</app-icon>{{ paymentLabels[o.paymentMethod] }}
          </span>
          @if (o.paymentStatus; as status) {
          <span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="paymentStatus[status].classes">{{ paymentStatus[status].label }}</span>
          }
        </p>
        }
        @if (o.receiptUrl; as receipt) {
        @if ($receiptAsLink()) {
        <a [href]="receipt" target="_blank" rel="noopener" class="text-primary inline-flex items-center gap-1 font-medium hover:underline">
          <app-icon class="h-4 w-4" aria-hidden="true">receipt_long</app-icon>Ver comprobante
        </a>
        } @else {
        <a [href]="receipt" target="_blank" rel="noopener" class="block w-fit" title="Abrir comprobante">
          <img [src]="$receiptImage() ?? receipt" alt="Comprobante de transferencia" loading="lazy" class="max-h-48 rounded-lg border border-[var(--border)] object-contain" (error)="$imageFailed.set(true)" />
        </a>
        }
        }
      </div>
      }

      <ul class="divide-y divide-[var(--border)]">
        @for (item of o.items; track $index) {
        <li class="flex gap-3 py-2 first:pt-0 last:pb-0">
          <span class="text-foreground w-7 shrink-0 text-sm font-semibold tabular-nums">{{ item.quantity }}×</span>
          <div class="min-w-0 flex-1">
            <p class="text-foreground text-sm font-medium">{{ item.name }}</p>
            @for (pack of item.packItems; track $index) {
            <p class="text-muted-foreground text-xs">· {{ pack.quantity > 1 ? pack.quantity + '× ' : '' }}{{ pack.name }}</p>
            }
            @for (modifier of item.modifiers; track $index) {
            <p class="text-muted-foreground text-xs">+ {{ modifier.quantity > 1 ? modifier.quantity + '× ' : '' }}{{ modifier.name }}</p>
            }
            @if (item.note) {
            <p class="mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-300">"{{ item.note }}"</p>
            }
          </div>
          <span class="text-foreground shrink-0 text-sm tabular-nums">{{ price(item.total) }}</span>
        </li>
        }
      </ul>

      @if (o.note) {
      <p class="glass-row text-foreground rounded-lg px-3 py-2 text-sm"><span class="text-muted-foreground text-xs">Nota del pedido:</span> {{ o.note }}</p>
      }

      <div class="flex flex-col gap-1 border-t border-[var(--border)] pt-3">
        @if (o.deliveryFee) {
        <div class="text-muted-foreground flex items-center justify-between text-sm">
          <span>Envío</span><span class="tabular-nums">{{ price(o.deliveryFee) }}</span>
        </div>
        }
        <div class="flex items-center justify-between">
          <span class="text-muted-foreground text-sm">Total</span>
          <span class="text-foreground text-lg font-semibold tabular-nums">{{ price(o.total) }}</span>
        </div>
      </div>

      @if (o.status === 'rejected' && o.rejectionReason) {
      <p class="text-sm text-red-700 dark:text-red-400"><span class="font-medium">Motivo:</span> {{ o.rejectionReason }}</p>
      }
      @if (o.status === 'accepted' && (o.invoiceNo || o.transactionId)) {
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        @if (o.invoiceNo) {
        <span class="text-muted-foreground">Venta <span class="text-foreground font-medium">{{ o.invoiceNo }}</span></span>
        }
        @if (o.transactionId) {
        <a [routerLink]="['/orders', o.transactionId]" class="text-primary inline-flex items-center gap-1 font-medium hover:underline">
          Ver pedido<app-icon class="h-4 w-4" aria-hidden="true">chevron_right</app-icon>
        </a>
        }
      </div>
      }

      @if (problem(); as text) {
      <p class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400" role="alert">{{ text }}</p>
      }

      @if (canManage()) {
      @if (o.status === 'pending') {
      @if ($isTransfer() && o.paymentStatus === 'awaiting_receipt') {
      <p class="text-muted-foreground -mb-1 text-center text-xs">El cliente aún no sube el comprobante.</p>
      }
      <div class="grid grid-cols-2 gap-2">
        <app-button full impact="light" tone="danger" type="button" [disabled]="!!busy()" (buttonClick)="reject.emit(o)">Rechazar</app-button>
        @if ($isTransfer()) {
        @if (o.paymentStatus === 'to_verify') {
        <app-button full impact="bold" tone="primary" type="button" [disabled]="!!busy()" [isLoading]="busy()" (buttonClick)="confirmPayment.emit(o)">Confirmar pago</app-button>
        } @else {
        <app-button full impact="bold" tone="primary" type="button" [disabled]="true">Esperando comprobante</app-button>
        }
        } @else {
        <app-button full impact="bold" tone="primary" type="button" [disabled]="!!busy()" [isLoading]="busy()" (buttonClick)="accept.emit(o)">Aceptar</app-button>
        }
      </div>
      } @else if ($nextSteps().length) {
      @let steps = $nextSteps();
      <div class="flex flex-col gap-2">
        <app-button full impact="bold" tone="primary" type="button" [disabled]="!!busy()" [isLoading]="busy()" (buttonClick)="advance.emit({ order: o, status: steps[0] })">
          {{ fulfillmentActions[steps[0]] }}
        </app-button>
        @if (steps.length > 1) {
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground text-center text-xs font-medium underline disabled:opacity-50"
          [disabled]="!!busy()"
          (click)="advance.emit({ order: o, status: steps[steps.length - 1] })">
          Marcar entregado directamente
        </button>
        }
      </div>
      }
      }
    </article>
  `,
})
export class CustomerOrderCardComponent {
  readonly order = input.required<CustomerOrderDto>();
  /** Hora actual (ms) para la espera en vivo. */
  readonly now = input(Date.now());
  readonly canManage = input(false);
  readonly busy = input(false);
  /** Zona horaria del negocio para "Programado para". */
  readonly timeZone = input<string | null>(null);
  /** Error al aceptar, con la sugerencia de rechazar. */
  readonly problem = input<string | null>(null);

  readonly accept = output<CustomerOrderDto>();
  readonly reject = output<CustomerOrderDto>();
  readonly confirmPayment = output<CustomerOrderDto>();
  readonly advance = output<FulfillmentRequest>();

  readonly statusLabels = CUSTOMER_ORDER_STATUS_LABELS;
  readonly statusClasses = STATUS_CLASSES;
  readonly channelLabels = CHANNEL_LABELS;
  readonly channelIcons = CHANNEL_ICONS;
  readonly paymentLabels = PAYMENT_METHOD_LABELS;
  readonly paymentStatus = PAYMENT_STATUS;
  readonly fulfillmentLabels = FULFILLMENT_LABELS;
  readonly fulfillmentActions = FULFILLMENT_ACTIONS;
  readonly price = formatMenuPrice;

  readonly $channel = computed(() => channelOf(this.order()));
  readonly $table = computed(() => tableLabel(this.order()));
  readonly $isTransfer = computed(() => this.order().paymentMethod === 'transfer_receipt');
  readonly $nextSteps = computed(() => nextFulfillmentSteps(this.order()));
  readonly $elapsed = computed(() => formatElapsed(this.order().createdAt, this.now()));
  readonly $isLate = computed(() => {
    const order = this.order();
    if (order.status !== 'pending' || (order.paymentMethod === 'transfer_receipt' && order.paymentStatus === 'awaiting_receipt')) return false;
    return this.now() - new Date(order.createdAt).getTime() >= LATE_MINUTES * 60000;
  });
  readonly $date = computed(() => formatOrderDate(this.order().decidedAt ?? this.order().createdAt));
  readonly $scheduled = computed(() => {
    const value = this.order().scheduledFor;
    return value ? formatScheduled(value, this.timeZone()) : '';
  });
  readonly $whatsapp = computed(() => {
    const phone = this.order().customerPhone;
    return phone ? whatsappUrl(phone) : null;
  });
  readonly $imageFailed = signal(false);
  /** Cada consulta trae otra URL firmada: la imagen conserva la primera para no recargarse en cada ciclo. */
  readonly $receiptImage = linkedSignal<string | null | undefined, string | null>({
    source: () => this.order().receiptUrl,
    computation: (url, previous) => (url && previous?.value && withoutQuery(previous.value) === withoutQuery(url) ? previous.value : (url ?? null)),
  });
  readonly $receiptAsLink = computed(() => {
    const url = this.order().receiptUrl;
    return !!url && (isPdfUrl(url) || this.$imageFailed());
  });

  mapUrl(latitude: number, longitude: number) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
}
