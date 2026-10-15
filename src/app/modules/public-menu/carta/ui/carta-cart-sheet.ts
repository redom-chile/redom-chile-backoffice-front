import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaCart, MAX_CART_LINES, MAX_CUSTOMER_NAME, MAX_LINE_NOTE, MAX_LINE_QUANTITY, MAX_ORDER_NOTE, readOrderError, toOrderLine } from '../carta-cart';
import { CartaI18n } from '../carta-i18n';
import { CartaIcon } from './carta-icon';
import { CartaStepper } from './carta-stepper';

const fieldClass =
  'mt-1.5 block w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * Contenido de la hoja del carrito: líneas, nombre, nota y "Enviar pedido" (POST /orders). Sin QR (retiro / delivery),
 * "Continuar" abre el pago.
 */
@Component({
  selector: 'app-carta-cart-sheet',
  imports: [CartaIcon, CartaStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let m = menu();
    @let items = cart.items();
    <div class="px-5 pb-6 pt-5">
      <h2 class="pr-10 text-xl font-bold tracking-tight">{{ t('cart.title') }}</h2>
      @if (m.table; as table) {
        <p class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <app-carta-icon name="chair" [size]="16" />
          {{ table.name }}
        </p>
      }

      @if (!m.location.isOpenNow) {
        <p class="mt-4 flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-medium" role="note">
          <app-carta-icon name="clock" [size]="18" class="mt-px" />
          {{ online() ? t('cart.closedSchedule') : t('cart.closed') }}
        </p>
      }

      @if (!items.length) {
        <div class="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <app-carta-icon name="bag" [size]="28" />
          <p>{{ t('cart.empty') }}</p>
        </div>
      } @else {
        <ul class="mt-4 divide-y divide-border rounded-2xl border border-border" [attr.aria-label]="t('cart.products')">
          @for (item of items; track item.key) {
            <li class="px-4 py-3" [class.bg-rose-500/5]="item.issue">
              <div class="flex items-start gap-3">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold leading-snug [overflow-wrap:anywhere]" [class.line-through]="item.issue">{{ item.name }}</p>
                  @if (item.details.length) {
                    <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ item.details.join(', ') }}</p>
                  }
                  @if (item.issue) {
                    <p class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <app-carta-icon name="alert" [size]="14" />
                      {{ item.issue }}
                    </p>
                  }
                </div>
                <span class="shrink-0 text-sm font-semibold tabular-nums">{{ format(item.unitPrice * item.line.quantity) }}</span>
              </div>

              @if (editingNote() === item.key) {
                <div class="mt-2">
                  <label class="sr-only" [for]="'carta-note-' + item.key">{{ t('cart.noteFor', { name: item.name }) }}</label>
                  <textarea
                    [id]="'carta-note-' + item.key"
                    rows="2"
                    [class]="fieldClass + ' resize-none'"
                    [placeholder]="t('cart.notePlaceholder')"
                    [attr.maxlength]="maxLineNote"
                    [value]="item.line.note ?? ''"
                    (input)="cart.setLineNote(item.key, $any($event.target).value)"
                  ></textarea>
                  <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{{ (item.line.note ?? '').length }}/{{ maxLineNote }}</span>
                    <button type="button" class="font-semibold text-foreground underline-offset-4 hover:underline" (click)="editingNote.set(null)">{{ t('cart.done') }}</button>
                  </div>
                </div>
              } @else if (item.line.note) {
                <p class="mt-1 text-xs italic text-muted-foreground [overflow-wrap:anywhere]">"{{ item.line.note }}"</p>
              }

              <div class="mt-2 flex items-center gap-2">
                <app-carta-stepper [value]="item.line.quantity" [min]="1" [max]="maxQuantity" [label]="item.name" [small]="true" (change)="cart.setQuantity(item.key, $event)" />
                @if (editingNote() !== item.key && !item.issue) {
                  <button
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    (click)="editingNote.set(item.key)"
                  >
                    {{ item.line.note ? t('cart.editNote') : t('cart.addNote') }}
                  </button>
                }
                <button
                  type="button"
                  class="ml-auto flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                  [attr.aria-label]="t('cart.remove', { name: item.name })"
                  (click)="cart.remove(item.key)"
                >
                  <app-carta-icon name="trash" [size]="16" />
                </button>
              </div>
            </li>
          }
        </ul>
        @if (items.length >= maxLines) {
          <p class="mt-2 text-xs text-muted-foreground">{{ t('cart.maxLines', { max: maxLines }) }}</p>
        }

        @if (!online()) {
        <div class="mt-5">
          <label for="carta-customer-name" class="text-sm font-semibold">{{ t('cart.nameLabel') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
          <input
            id="carta-customer-name"
            type="text"
            autocomplete="given-name"
            [class]="fieldClass"
            [placeholder]="t('cart.namePlaceholder')"
            [attr.maxlength]="maxName"
            [value]="cart.customerName()"
            (input)="cart.setCustomerName($any($event.target).value)"
          />
        </div>
        <div class="mt-4">
          <label for="carta-order-note" class="text-sm font-semibold">{{ t('cart.noteLabel') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
          <textarea
            id="carta-order-note"
            rows="2"
            [class]="fieldClass + ' resize-none'"
            [placeholder]="t('cart.orderNotePlaceholder')"
            [attr.maxlength]="maxOrderNote"
            aria-describedby="carta-order-note-count"
            [value]="cart.note()"
            (input)="cart.setNote($any($event.target).value)"
          ></textarea>
          <p id="carta-order-note-count" class="mt-1 text-right text-xs text-muted-foreground">{{ cart.note().length }}/{{ maxOrderNote }}</p>
        </div>
        }

        <div class="mt-4 flex items-baseline justify-between gap-3">
          <span class="text-sm font-semibold">{{ online() ? t('cart.subtotal') : t('cart.total') }}</span>
          <span class="text-lg font-bold tabular-nums">{{ format(cart.total()) }}</span>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ online() ? t('cart.shippingNext') : t('cart.totalConfirm') }}
        </p>
      }
    </div>

    @if (items.length) {
      <div class="sticky bottom-0 z-10 border-t border-border bg-background/95 px-5 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        @if (error(); as e) {
          <p class="mb-2 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
            <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
            <span>{{ e }}</span>
          </p>
        } @else if (cart.hasIssues()) {
          <p class="mb-2 text-center text-xs font-medium text-muted-foreground" role="note">{{ t('cart.removeMarked') }}</p>
        }
        @if (online()) {
          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            [disabled]="cart.hasIssues()"
            (click)="checkout.emit()"
          >
            {{ t('cart.continue') }}
            <app-carta-icon name="chevron-right" [size]="18" />
          </button>
        } @else {
        <button
          type="button"
          class="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          [disabled]="sending() || !m.location.isOpenNow || cart.hasIssues()"
          [attr.aria-busy]="sending() || null"
          (click)="send()"
        >
          @if (sending()) {
            <span class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true"></span>
            {{ t('cart.sending') }}
          } @else if (!m.location.isOpenNow) {
            {{ t('cart.closed') }}
          } @else {
            {{ t('cart.send') }}
          }
        </button>
        }
      </div>
    }
  `,
})
export class CartaCartSheet {
  readonly menu = input.required<PublicLocationMenuDto>();
  /** Código de la mesa; null sin QR (retiro / delivery). */
  readonly qr = input<string | null>(null);
  /** Etapa 5: sin QR, "Continuar" lleva al pago (checkout) en vez de enviar el pedido. */
  readonly online = input(false);
  readonly checkout = output<void>();
  /** Pedido creado (200). */
  readonly ordered = output<PublicOrderDto>();
  /** La carta cambió (producto agotado, fuera de horario...): recargarla. */
  readonly refresh = output<void>();

  protected readonly cart = inject(CartaCart);
  protected readonly t = inject(CartaI18n).t;
  readonly #api = inject(PublicMenuApiService);

  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editingNote = signal<string | null>(null);

  protected readonly format = formatMenuPrice;
  protected readonly fieldClass = fieldClass;
  protected readonly maxQuantity = MAX_LINE_QUANTITY;
  protected readonly maxLineNote = MAX_LINE_NOTE;
  protected readonly maxOrderNote = MAX_ORDER_NOTE;
  protected readonly maxName = MAX_CUSTOMER_NAME;
  protected readonly maxLines = MAX_CART_LINES;

  #request: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  protected send(): void {
    const items = this.cart.items();
    const qr = this.qr();
    if (!qr || this.sending() || !items.length || items.length > MAX_CART_LINES || this.cart.hasIssues() || !this.menu().location.isOpenNow) return;
    this.sending.set(true);
    this.error.set(null);
    this.editingNote.set(null);
    const name = this.cart.customerName().trim().slice(0, MAX_CUSTOMER_NAME);
    const note = this.cart.note().trim().slice(0, MAX_ORDER_NOTE);
    this.#request = this.#api
      .createOrder({
        qrCode: qr,
        items: items.map(toOrderLine),
        ...(name ? { customerName: name } : {}),
        ...(note ? { note } : {}),
      })
      .subscribe({
        next: (order) => {
          this.sending.set(false);
          this.cart.ordered(order);
          this.ordered.emit(order);
        },
        error: (e) => {
          this.sending.set(false);
          const err = readOrderError(e);
          this.error.set(err.message);
          if (err.productId != null && err.reason) this.cart.markProduct(err.productId, err.reason);
          else if (err.pack) this.cart.markPackGroup(this.menu(), err.groupId, err.message);
          if (err.reload) this.refresh.emit();
        },
      });
  }
}
