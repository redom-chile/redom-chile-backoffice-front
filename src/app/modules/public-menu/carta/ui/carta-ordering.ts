import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaCart } from '../carta-cart';
import { CartaCartSheet } from './carta-cart-sheet';
import { CartaDialog } from './carta-dialog';
import { CartaIcon } from './carta-icon';
import { CartaMyOrders, CartaOrderTracking } from './carta-order-tracking';

/**
 * Pedidos desde la mesa: botón flotante del carrito, aviso "Agregado" y las hojas (carrito, mis pedidos, tu pedido).
 * Solo se muestra con ?qr= y features.tableOrdering.
 */
@Component({
  selector: 'app-carta-ordering',
  imports: [CartaDialog, CartaIcon, CartaCartSheet, CartaOrderTracking, CartaMyOrders],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let m = menu();
    @let count = cart.count();
    <!-- Con la barra inferior (CARTA_BOTTOM_BAR) el carrito y el aviso "Agregado" van en la barra -->
    @if (fab()) {
    <!-- Espacio para que el botón flotante no tape el final de la carta -->
    @if (count) {
      <div class="h-24" aria-hidden="true"></div>
    }

    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div class="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4">
        <p class="sr-only" aria-live="polite">{{ cart.notice() }}</p>
        @if (cart.notice(); as n) {
          <p class="pointer-events-auto flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg" aria-hidden="true">
            <app-carta-icon name="check" [size]="16" />
            {{ n }}
          </p>
        }
        @if (count) {
          <button
            type="button"
            class="pointer-events-auto flex min-h-14 w-full items-center gap-3 rounded-full bg-primary px-5 py-3 text-left text-primary-foreground shadow-xl transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            (click)="cart.sheet.set({ kind: 'cart' })"
          >
            <span class="relative">
              <app-carta-icon name="bag" [size]="22" />
              <span class="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1 text-[11px] font-bold text-primary">{{ count }}</span>
            </span>
            <span class="flex-1 text-sm font-semibold">Ver carrito <span class="sr-only">({{ count }} {{ count === 1 ? 'producto' : 'productos' }})</span></span>
            <span class="text-sm font-bold tabular-nums">{{ format(cart.total()) }}</span>
          </button>
        }
      </div>
    </div>
    }

    @switch (sheetKind()) {
      @case ('cart') {
        <app-carta-dialog label="Tu carrito" (closed)="close('cart')">
          <app-carta-cart-sheet [menu]="m" [qr]="qr()" (ordered)="onOrdered($event)" (refresh)="refresh.emit()" />
        </app-carta-dialog>
      }
      @case ('orders') {
        <app-carta-dialog label="Mis pedidos" (closed)="close('orders')">
          <app-carta-my-orders [ids]="cart.orderIds()" [timeZone]="m.location.timeZone" (open)="cart.sheet.set({ kind: 'order', id: $event, order: null })" />
        </app-carta-dialog>
      }
      @case ('order') {
        @if (orderSheet(); as s) {
          <app-carta-dialog label="Tu pedido" (closed)="close('order')">
            <app-carta-order-tracking [orderId]="s.id" [initial]="s.order" [timeZone]="m.location.timeZone" (back)="cart.sheet.set(null)" />
          </app-carta-dialog>
        }
      }
    }
  `,
})
export class CartaOrdering {
  readonly menu = input.required<PublicLocationMenuDto>();
  readonly qr = input.required<string>();
  /** false: sin el botón flotante del carrito (lo reemplaza la barra inferior). */
  readonly fab = input(true);
  /** Recargar la carta (un producto se agotó o salió de horario). */
  readonly refresh = output<void>();

  protected readonly cart = inject(CartaCart);
  protected readonly format = formatMenuPrice;

  protected readonly sheetKind = () => this.cart.sheet()?.kind ?? null;
  protected readonly orderSheet = () => {
    const s = this.cart.sheet();
    return s?.kind === 'order' ? s : null;
  };

  /** Solo cierra si sigue abierta la misma hoja (al cambiar de hoja, la anterior se destruye). */
  protected close(kind: 'cart' | 'orders' | 'order'): void {
    if (this.cart.sheet()?.kind === kind) this.cart.sheet.set(null);
  }

  protected onOrdered(order: PublicOrderDto): void {
    this.cart.sheet.set({ kind: 'order', id: order.id, order });
  }
}
