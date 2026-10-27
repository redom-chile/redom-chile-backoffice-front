import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ct, ctn } from '../carta-i18n';
import { TableServiceStatus } from '../carta-table-service';
import { CartaIcon, CartaIconName } from './carta-icon';

/**
 * EXPERIMENTAL: barra inferior "liquid glass" con los atajos de la carta. Para volver a los botones flotantes, pon
 * CARTA_BOTTOM_BAR en false (carta-menu-view usa entonces el FAB del carrito, los botones flotantes de la mesa y
 * "Reservar" en el encabezado).
 */
export const CARTA_BOTTOM_BAR = true;

export type CartaBarAction = 'waiter' | 'bill' | 'cart' | 'orders' | 'booking' | 'profile';

type Item = Readonly<{
  action: CartaBarAction;
  label: string;
  ariaLabel: string;
  icon: CartaIconName;
  badge?: number;
  /** Punto de estado (llamado abierto). */
  dot?: boolean;
  /** Resaltado (carrito con productos). */
  highlight?: boolean;
}>;

/**
 * Barra inferior con atajos (Mesero, Cuenta, Carrito, Mis pedidos, Reservar): solo los que aplican; sin ninguno no se
 * muestra. Fija abajo con el área segura del teléfono y un espacio al final de la carta para no tapar el contenido.
 * Solo abre las hojas: el padre decide qué hacer con (action).
 */
@Component({
  selector: 'app-carta-bottom-bar',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  styles: `
    .carta-glass {
      background: color-mix(in srgb, var(--background) 94%, transparent);
      border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.35),
        inset 0 -1px 0 color-mix(in srgb, var(--foreground) 4%, transparent),
        0 12px 32px -12px rgba(0, 0, 0, 0.35),
        0 2px 8px rgba(0, 0, 0, 0.08);
    }
    @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .carta-glass {
        background: color-mix(in srgb, var(--background) 60%, transparent);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        backdrop-filter: blur(20px) saturate(180%);
      }
    }
    :host-context(.dark) .carta-glass {
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.14),
        0 12px 32px -12px rgba(0, 0, 0, 0.7),
        0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .carta-bar-item {
      transition: transform 160ms ease, color 160ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .carta-bar-item:active {
      transform: scale(0.94);
    }
    /* Píldora brillante detrás del ícono al presionar o con estado */
    .carta-bar-pill {
      transition: background-color 160ms ease, box-shadow 160ms ease;
    }
    .carta-bar-item:active .carta-bar-pill,
    .carta-bar-item:hover .carta-bar-pill,
    .carta-bar-pill[data-on='true'] {
      background: color-mix(in srgb, var(--foreground) 9%, transparent);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.45),
        inset 0 0 0 1px color-mix(in srgb, var(--foreground) 6%, transparent);
    }
    .carta-bar-pill[data-highlight='true'] {
      background: color-mix(in srgb, var(--primary) 18%, transparent);
      color: var(--primary);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.45),
        inset 0 0 0 1px color-mix(in srgb, var(--primary) 25%, transparent);
    }
    @media (prefers-reduced-motion: reduce) {
      .carta-bar-item,
      .carta-bar-pill {
        transition: none;
      }
      .carta-bar-item:active {
        transform: none;
      }
    }
  `,
  template: `
    @if (items().length) {
      <!-- Espacio para que la barra no tape el final de la carta ni el pie -->
      <div class="h-[calc(6.5rem+env(safe-area-inset-bottom))]" aria-hidden="true"></div>

      <div class="carta-embed-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div class="mx-auto flex max-w-md flex-col items-center gap-2">
          <p class="sr-only" aria-live="polite">{{ notice() ?? status()?.text ?? '' }}</p>
          @if (notice(); as n) {
            <p class="carta-glass pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground" aria-hidden="true">
              <app-carta-icon name="check" [size]="16" class="text-primary" />
              {{ n }}
            </p>
          } @else if (status(); as s) {
            <div class="carta-glass pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 text-sm font-semibold text-foreground" aria-hidden="true">
              <span class="size-2 shrink-0 rounded-full" [class]="s.tone === 'open' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              <span class="min-w-0 [overflow-wrap:anywhere]">{{ s.text }}</span>
              <button
                type="button"
                class="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                [attr.aria-label]="t('bar.hideNotice')"
                (click)="dismissStatus.emit(s.id)"
              >
                <app-carta-icon name="x" [size]="14" />
              </button>
            </div>
          }

          <nav class="carta-glass pointer-events-auto w-full rounded-[1.75rem] p-1.5" [attr.aria-label]="t('bar.nav')">
            <ul class="flex items-stretch">
              @for (item of items(); track item.action) {
                <li class="min-w-0 flex-1">
                  <button
                    type="button"
                    class="carta-bar-item flex w-full flex-col items-center gap-0.5 rounded-[1.25rem] px-1 py-1 text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                    [attr.aria-label]="item.ariaLabel"
                    (click)="action.emit(item.action)"
                  >
                    <span
                      class="carta-bar-pill relative flex h-8 w-12 items-center justify-center rounded-full"
                      [attr.data-on]="item.dot ? 'true' : null"
                      [attr.data-highlight]="item.highlight ? 'true' : null"
                    >
                      <app-carta-icon [name]="item.icon" [size]="20" />
                      @if (item.badge) {
                        <span class="absolute -right-0.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold leading-none text-primary-foreground shadow-sm tabular-nums">{{ item.badge }}</span>
                      }
                      @if (item.dot) {
                        <span class="absolute right-1.5 top-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-background"></span>
                      }
                    </span>
                    <span class="w-full truncate text-center text-[0.6875rem] font-semibold leading-tight">{{ item.label }}</span>
                  </button>
                </li>
              }
            </ul>
          </nav>
        </div>
      </div>
    }
  `,
})
export class CartaBottomBar {
  /** null: sin "Mesero" ni "Cuenta". */
  readonly table = input<Readonly<{ callOpen: boolean; attended: boolean; billOpen: boolean }> | null>(null);
  /** null: sin pedidos desde la mesa (sin "Carrito"). */
  readonly cartCount = input<number | null>(null);
  /** 'cart' ("Carrito") en la mesa; 'order' ("Pedir") con retiro / delivery. También acepta esos textos en español. */
  readonly cartLabel = input<'cart' | 'order'>('cart');
  readonly ordersCount = input(0);
  readonly booking = input(false);
  /** Etapa 10: "Perfil" (el local activó el cliente reconocido). */
  readonly profile = input(false);
  /** "Agregado" del carrito. */
  readonly notice = input<string | null>(null);
  /** "Ya avisamos al mesero" / "El mesero va en camino". */
  readonly status = input<TableServiceStatus | null>(null);

  readonly action = output<CartaBarAction>();

  protected readonly t = ct;
  readonly dismissStatus = output<number>();

  protected readonly items = computed<Item[]>(() => {
    const list: Item[] = [];
    const table = this.table();
    if (table) {
      const waiterLabel = table.callOpen ? ct('bar.waiterNotified') : table.attended ? ct('bar.waiterComing') : ct('bar.waiter');
      list.push({
        action: 'waiter',
        label: waiterLabel,
        ariaLabel: table.callOpen ? ct('bar.callWaiterNotified') : table.attended ? ct('bar.callWaiterComing') : ct('bar.callWaiter'),
        icon: 'bell',
        dot: table.callOpen,
      });
      list.push({
        action: 'bill',
        label: ct('bar.bill'),
        ariaLabel: table.billOpen ? ct('bar.askBillDone') : ct('bar.askBill'),
        icon: 'wallet',
        dot: table.billOpen,
      });
    }
    const count = this.cartCount();
    if (count != null) {
      list.push({
        action: 'cart',
        label: this.#cartLabel(),
        ariaLabel: count ? ctn('bar.viewCart', count) : ct('bar.viewCartEmpty'),
        icon: 'bag',
        badge: count,
        highlight: count > 0,
      });
    }
    // Mesa: los pedidos se abren en la hoja; retiro / delivery: enlazan a /carta/pedido/{id}
    if (this.ordersCount() > 0) list.push({ action: 'orders', label: ct('bar.orders'), ariaLabel: ct('bar.myOrders'), icon: 'receipt' });
    if (this.booking()) list.push({ action: 'booking', label: ct('bar.book'), ariaLabel: ct('bar.bookTable'), icon: 'calendar' });
    if (this.profile()) list.push({ action: 'profile', label: ct('customer.bar'), ariaLabel: ct('customer.title'), icon: 'user' });
    return list;
  });

  #cartLabel(): string {
    return ct(this.cartLabel() === 'order' ? 'bar.order' : 'bar.cart');
  }
}
