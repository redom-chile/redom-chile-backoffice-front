import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaCart } from '../carta-cart';
import { CartaEmbed } from '../carta-embed';
import { CARTA_BASE_PATH } from '../carta-utils';
import { CartaCartSheet } from './carta-cart-sheet';
import { CartaCheckoutSheet } from './carta-checkout-sheet';
import { CartaDialog } from './carta-dialog';
import { CartaI18n } from '../carta-i18n';
import { CartaIcon } from './carta-icon';
import { CartaMyOrders, CartaOrderTracking } from './carta-order-tracking';

/**
 * Pedidos desde la mesa: botón flotante del carrito, aviso "Agregado" y las hojas (carrito, mis pedidos, tu pedido).
 * Se muestra con ?qr= y features.tableOrdering, o sin QR con retiro / delivery (etapa 5: el carrito lleva al pago y,
 * tras pedir, a /carta/pedido/{id}).
 */
@Component({
  selector: 'app-carta-ordering',
  imports: [CartaDialog, CartaIcon, CartaCartSheet, CartaCheckoutSheet, CartaOrderTracking, CartaMyOrders],
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

    <div class="carta-embed-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
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
              <span class="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-primary-foreground px-1 text-[0.6875rem] font-bold text-primary">{{ count }}</span>
            </span>
            <span class="flex-1 text-sm font-semibold">{{ t('cart.view') }} <span class="sr-only">({{ tn('cart.items', count) }})</span></span>
            <span class="text-sm font-bold tabular-nums">{{ format(cart.total()) }}</span>
          </button>
        }
      </div>
    </div>
    }

    @switch (sheetKind()) {
      @case ('cart') {
        <app-carta-dialog [label]="t('cart.title')" (closed)="close('cart')">
          <app-carta-cart-sheet
            [menu]="m"
            [qr]="qr()"
            [online]="!qr()"
            (ordered)="onOrdered($event)"
            (checkout)="cart.sheet.set({ kind: 'checkout' })"
            (refresh)="refresh.emit()"
          />
        </app-carta-dialog>
      }
      @case ('checkout') {
        <app-carta-dialog [label]="t('checkout.title')" (closed)="close('checkout')">
          <app-carta-checkout-sheet [menu]="m" (ordered)="onOrdered($event)" (back)="cart.sheet.set({ kind: 'cart' })" (refresh)="refresh.emit()" />
        </app-carta-dialog>
      }
      @case ('orders') {
        <app-carta-dialog [label]="t('orders.title')" (closed)="close('orders')">
          <app-carta-my-orders
            [ids]="cart.orderIds()"
            [timeZone]="m.location.timeZone"
            [linkBase]="qr() ? null : orderPath"
            [linkState]="linkState()"
            [emptyText]="qr() ? t('orders.emptyTable') : t('orders.emptyOnline')"
            (open)="cart.sheet.set({ kind: 'order', id: $event, order: null })"
          />
        </app-carta-dialog>
      }
      @case ('order') {
        @if (orderSheet(); as s) {
          <app-carta-dialog [label]="t('order.title')" (closed)="close('order')">
            <app-carta-order-tracking [orderId]="s.id" [initial]="s.order" [timeZone]="m.location.timeZone" (back)="cart.sheet.set(null)" />
          </app-carta-dialog>
        }
      }
    }
  `,
})
export class CartaOrdering {
  readonly menu = input.required<PublicLocationMenuDto>();
  /** Código de la mesa; null: retiro / delivery. */
  readonly qr = input<string | null>(null);
  /** false: sin el botón flotante del carrito (lo reemplaza la barra inferior). */
  readonly fab = input(true);
  /** Recargar la carta (un producto se agotó o salió de horario). */
  readonly refresh = output<void>();

  protected readonly cart = inject(CartaCart);
  readonly #i18n = inject(CartaI18n);
  protected readonly t = this.#i18n.t;
  protected readonly tn = this.#i18n.tn;
  readonly #router = inject(Router);
  readonly #embed = inject(CartaEmbed);
  /** /carta/pedido */
  protected readonly orderPath = `${inject(CARTA_BASE_PATH)}/pedido`;
  /** Para volver a esta carta desde el seguimiento. */
  protected readonly linkState = () => ({ back: typeof location === 'undefined' ? null : location.pathname, timeZone: this.menu().location.timeZone });
  protected readonly format = formatMenuPrice;

  protected readonly sheetKind = () => this.cart.sheet()?.kind ?? null;
  protected readonly orderSheet = () => {
    const s = this.cart.sheet();
    return s?.kind === 'order' ? s : null;
  };

  /** Solo cierra si sigue abierta la misma hoja (al cambiar de hoja, la anterior se destruye). */
  protected close(kind: 'cart' | 'checkout' | 'orders' | 'order'): void {
    if (this.cart.sheet()?.kind === kind) this.cart.sheet.set(null);
  }

  protected onOrdered(order: PublicOrderDto): void {
    if (this.qr()) {
      this.cart.sheet.set({ kind: 'order', id: order.id, order });
      return;
    }
    // Retiro / delivery: el seguimiento tiene su propia página (la misma de los correos)
    this.cart.sheet.set(null);
    const tree = this.#embed.withParams(this.#router.parseUrl(`${this.orderPath}/${order.id}`));
    void this.#router.navigateByUrl(tree, { state: { ...this.linkState(), order } });
  }
}
