import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerOrderDto, formatMenuPrice } from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, IconComponent } from 'src/ui';
import { CUSTOMER_ORDER_STATUS_LABELS, formatElapsed, formatOrderDate, tableLabel } from './customer-order-format';

// Minutos de espera desde los que el pendiente se destaca.
const LATE_MINUTES = 5;

const STATUS_CLASSES = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  accepted: 'bg-green-500/15 text-green-700 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-400',
  cancelled: 'bg-muted/40 text-muted-foreground',
} as const;

/** Un pedido de cliente: mesa, espera, productos con sus opciones y total; Aceptar y Rechazar si está pendiente. */
@Component({
  selector: 'app-customer-order-card',
  imports: [RouterLink, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let o = order();
    <article class="glass flex flex-col gap-3 rounded-[1rem] p-4" [class.ring-2]="$isLate()" [class.ring-amber-500]="$isLate()">
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-foreground truncate text-lg font-semibold">{{ $table() }}</h3>
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
        <div class="flex shrink-0 flex-col items-end gap-1">
          @if (o.status !== 'pending') {
          <span class="rounded-full px-2 py-0.5 text-xs font-semibold" [class]="statusClasses[o.status]">{{ statusLabels[o.status] }}</span>
          }
          @if (o.autoAccepted) {
          <span class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
            <app-icon class="h-3 w-3" aria-hidden="true">bolt</app-icon>Automático
          </span>
          }
        </div>
      </header>

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

      <div class="flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span class="text-muted-foreground text-sm">Total</span>
        <span class="text-foreground text-lg font-semibold tabular-nums">{{ price(o.total) }}</span>
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

      @if (o.status === 'pending' && canManage()) {
      <div class="grid grid-cols-2 gap-2">
        <app-button full impact="light" tone="danger" type="button" [disabled]="!!busy()" (buttonClick)="reject.emit(o)">Rechazar</app-button>
        <app-button full impact="bold" tone="primary" type="button" [disabled]="!!busy()" [isLoading]="busy()" (buttonClick)="accept.emit(o)">Aceptar</app-button>
      </div>
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
  /** Error al aceptar, con la sugerencia de rechazar. */
  readonly problem = input<string | null>(null);

  readonly accept = output<CustomerOrderDto>();
  readonly reject = output<CustomerOrderDto>();

  readonly statusLabels = CUSTOMER_ORDER_STATUS_LABELS;
  readonly statusClasses = STATUS_CLASSES;
  readonly price = formatMenuPrice;

  readonly $table = computed(() => tableLabel(this.order()));
  readonly $elapsed = computed(() => formatElapsed(this.order().createdAt, this.now()));
  readonly $isLate = computed(
    () => this.order().status === 'pending' && this.now() - new Date(this.order().createdAt).getTime() >= LATE_MINUTES * 60000,
  );
  readonly $date = computed(() => formatOrderDate(this.order().decidedAt ?? this.order().createdAt));
}
