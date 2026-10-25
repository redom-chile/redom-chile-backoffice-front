import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { OnlineChannel, OnlinePaymentMethod, PublicOnlineDto } from '../../data-access/dtos/online-orders.dto';
import { PublicLocationMenuDto } from '../../data-access/dtos/public-menu.dto';
import { PublicMenuApiService } from '../../data-access/public-menu-api.service';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaCart, MAX_CART_LINES, MAX_ORDER_NOTE, toOrderLine } from '../carta-cart';
import {
  CHANNEL_LABELS,
  estimateZone,
  isEmail,
  methodsFor,
  ONLINE_LIMITS,
  PAYMENT_LABELS,
  phoneDigits,
  readOnlineOrderError,
  saveCustomer,
  scheduleDays,
  zoneCommunes,
} from '../carta-online';
import { CartaI18n, cartaErrorMessage, ct } from '../carta-i18n';
import { CartaCustomer } from '../carta-customer';
import { readApiError } from 'src/app/core/utils/api-error';
import { CartaIcon, CartaIconName } from './carta-icon';

type Field = 'name' | 'phone' | 'email' | 'street' | 'commune' | 'when' | 'payment';

const INPUT =
  'mt-1.5 block w-full rounded-2xl border bg-card px-4 py-3 text-[0.9375rem] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30 motion-reduce:transition-none';

const OPTION =
  'flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm transition has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none';

const PAYMENT_ICONS: Record<OnlinePaymentMethod, CartaIconName> = {
  transfer_receipt: 'wallet',
  cash_on_pickup: 'banknote',
  card_on_pickup: 'card',
  cash_on_delivery: 'banknote',
  card_on_delivery: 'card',
};

/** Ubicación del navegador: lo que pasó al pedirla. */
type LocateState = 'idle' | 'locating' | 'done' | 'denied' | 'error';

/**
 * Pedido de retiro o delivery (etapa 5), en una sola hoja: 1) retiro o delivery, 2) tus datos (se recuerdan en
 * redom-customer), 3) dirección y zona (delivery), 4) hora (lo antes posible o programada, en la zona del local) y
 * 5) método de pago y resumen. POST /orders sin qrCode; el backend confirma zona, envío y total.
 */
@Component({
  selector: 'app-carta-checkout-sheet',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let m = menu();
    @let o = online();
    @let est = zoneEstimate();
    <div class="px-5 pb-6 pt-5">
      <button
        type="button"
        class="-ml-2 mb-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        (click)="back.emit()"
      >
        <app-carta-icon name="chevron-left" [size]="16" />
        {{ t('checkout.back') }}
      </button>
      <h2 class="pr-10 text-xl font-bold tracking-tight">{{ t('checkout.title') }}</h2>
      <p class="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{{ m.location.name }}</p>

      <form class="mt-5 grid gap-6" novalidate (submit)="submit($event)">
        <!-- 1. Retiro o delivery -->
        <fieldset>
          <legend class="text-base font-semibold">{{ t('checkout.howReceive') }}</legend>
          <div class="mt-2 grid gap-2" [class.sm:grid-cols-2]="channels().length > 1">
            @for (c of channels(); track c) {
              <label [class]="option">
                <input type="radio" class="size-4 accent-primary" name="carta-channel" [value]="c" [checked]="channel() === c" (change)="setChannel(c)" />
                <app-carta-icon [name]="c === 'pickup' ? 'store' : 'truck'" [size]="20" class="text-muted-foreground" />
                <span class="flex-1 font-semibold">{{ channelLabels[c] }}</span>
              </label>
            }
          </div>
          @if (o.delivery && !communes().length) {
            <p class="mt-2 text-xs text-muted-foreground">{{ t('checkout.deliveryUnavailable') }}</p>
          }
          @if (channel() === 'pickup' && m.location.address) {
            <p class="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <app-carta-icon name="map-pin" [size]="16" class="mt-0.5" />
              <span class="[overflow-wrap:anywhere]">{{ t('checkout.pickupAt', { address: m.location.address }) }}</span>
            </p>
          }
        </fieldset>

        <!-- 2. Tus datos -->
        <fieldset class="grid gap-4">
          <legend class="text-base font-semibold">{{ t('checkout.yourData') }}</legend>
          <div class="-mt-2">
            <label for="carta-co-name" class="block text-sm font-semibold">{{ t('checkout.name') }}</label>
            <input
              id="carta-co-name"
              type="text"
              autocomplete="name"
              [class]="inputClass('name')"
              [maxLength]="limits.name"
              [value]="name()"
              [attr.aria-invalid]="!!errors().name"
              [attr.aria-describedby]="errors().name ? 'carta-co-name-error' : null"
              (input)="name.set($any($event.target).value)"
            />
            @if (errors().name; as e) {
              <p id="carta-co-name-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
            }
          </div>
          <div>
            <label for="carta-co-phone" class="block text-sm font-semibold">{{ t('checkout.phone') }}</label>
            <input
              id="carta-co-phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+56 9 1234 5678"
              maxlength="24"
              [class]="inputClass('phone')"
              [value]="phone()"
              [attr.aria-invalid]="!!errors().phone"
              [attr.aria-describedby]="errors().phone ? 'carta-co-phone-error' : 'carta-co-phone-hint'"
              (input)="phone.set($any($event.target).value)"
            />
            @if (errors().phone; as e) {
              <p id="carta-co-phone-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
            } @else {
              <p id="carta-co-phone-hint" class="mt-1 text-xs text-muted-foreground">{{ t('checkout.phoneHint') }}</p>
            }
          </div>
          <div>
            @let locked = lockedEmail();
            <label for="carta-co-email" class="block text-sm font-semibold">
              {{ t('checkout.email') }}
              @if (!locked) {
                <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span>
              }
            </label>
            <input
              id="carta-co-email"
              type="email"
              inputmode="email"
              autocomplete="email"
              [placeholder]="t('checkout.emailPlaceholder')"
              [class]="inputClass('email') + (locked ? ' bg-muted text-muted-foreground' : '')"
              [maxLength]="limits.email"
              [readOnly]="!!locked"
              [value]="locked ?? email()"
              [attr.aria-invalid]="!!errors().email"
              [attr.aria-describedby]="errors().email ? 'carta-co-email-error' : 'carta-co-email-hint'"
              (input)="email.set($any($event.target).value)"
            />
            @if (errors().email; as e) {
              <p id="carta-co-email-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
              @if (profileEmail(); as p) {
                <button type="button" class="mt-1 text-sm font-semibold text-primary underline-offset-4 hover:underline" (click)="useProfileEmail(p)">
                  {{ t('customer.useEmail', { email: p }) }}
                </button>
              } @else if (locked) {
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ t('customer.notYou') }}
                  <button type="button" class="font-semibold text-primary underline-offset-4 hover:underline" (click)="notMe()">{{ t('customer.logout') }}</button>
                </p>
              }
            } @else if (locked) {
              <p id="carta-co-email-hint" class="mt-1 text-xs text-muted-foreground">
                {{ t('customer.emailLocked') }} {{ t('customer.notYou') }}
                <button type="button" class="font-semibold text-primary underline-offset-4 hover:underline" (click)="notMe()">{{ t('customer.logout') }}</button>
              </p>
            } @else {
              <p id="carta-co-email-hint" class="mt-1 text-xs text-muted-foreground">{{ t('checkout.emailHint') }}</p>
            }
          </div>
        </fieldset>

        <!-- 3. Dirección (delivery) -->
        @if (channel() === 'delivery') {
          <fieldset class="grid gap-4">
            <legend class="text-base font-semibold">{{ t('checkout.address') }}</legend>
            <div class="-mt-2">
              <label for="carta-co-commune" class="block text-sm font-semibold">{{ t('checkout.commune') }}</label>
              <select
                id="carta-co-commune"
                [class]="inputClass('commune')"
                [attr.aria-invalid]="!!errors().commune"
                [attr.aria-describedby]="errors().commune ? 'carta-co-commune-error' : null"
                (change)="setCommune($any($event.target).value)"
              >
                <option value="" [selected]="communeId() == null" disabled>{{ t('checkout.chooseCommune') }}</option>
                @for (c of communes(); track c.id) {
                  <option [value]="c.id" [selected]="communeId() === c.id">{{ c.name }}</option>
                }
              </select>
              @if (errors().commune; as e) {
                <p id="carta-co-commune-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
              }
            </div>
            <div class="grid grid-cols-[1fr_7rem] gap-3">
              <div>
                <label for="carta-co-street" class="block text-sm font-semibold">{{ t('checkout.street') }}</label>
                <input
                  id="carta-co-street"
                  type="text"
                  autocomplete="address-line1"
                  placeholder="Av. Providencia"
                  [class]="inputClass('street')"
                  [maxLength]="limits.street"
                  [value]="street()"
                  [attr.aria-invalid]="!!errors().street"
                  [attr.aria-describedby]="errors().street ? 'carta-co-street-error' : null"
                  (input)="street.set($any($event.target).value)"
                />
              </div>
              <div>
                <label for="carta-co-number" class="block text-sm font-semibold">{{ t('checkout.number') }}</label>
                <input
                  id="carta-co-number"
                  type="text"
                  inputmode="numeric"
                  placeholder="1234"
                  [class]="inputClass(null)"
                  [maxLength]="limits.number"
                  [value]="number()"
                  (input)="number.set($any($event.target).value)"
                />
              </div>
              @if (errors().street; as e) {
                <p id="carta-co-street-error" class="col-span-2 -mt-2 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
              }
            </div>
            <div>
              <label for="carta-co-details" class="block text-sm font-semibold">{{ t('checkout.details') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
              <input
                id="carta-co-details"
                type="text"
                autocomplete="address-line2"
                [placeholder]="t('checkout.detailsPlaceholder')"
                [class]="inputClass(null)"
                [maxLength]="limits.details"
                [value]="details()"
                (input)="details.set($any($event.target).value)"
              />
            </div>

            @if (hasRadiusZones()) {
              <div class="flex flex-wrap items-center gap-2">
                @if (coords()) {
                  <p class="flex flex-1 items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
                    <app-carta-icon name="check" [size]="16" />
                    {{ t('checkout.usingLocation') }}
                  </p>
                  <button type="button" class="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground" (click)="clearCoords()">
                    {{ t('checkout.removeLocation') }}
                  </button>
                } @else {
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
                    [disabled]="locate() === 'locating'"
                    (click)="useLocation()"
                  >
                    <app-carta-icon name="locate" [size]="16" />
                    {{ locate() === 'locating' ? t('checkout.locating') : t('checkout.useLocation') }}
                  </button>
                  @if (locate() === 'denied') {
                    <p class="w-full text-sm text-muted-foreground" role="status">{{ t('checkout.locationDenied') }}</p>
                  } @else if (locate() === 'error') {
                    <p class="w-full text-sm text-muted-foreground" role="status">{{ t('checkout.locationError') }}</p>
                  }
                }
              </div>
            }

            <div class="rounded-2xl bg-muted px-4 py-3 text-sm" aria-live="polite">
              @switch (est.kind) {
                @case ('zone') {
                  @if (est.kind === 'zone') {
                    <p class="font-semibold">{{ t('checkout.shippingTo', { zone: est.zone.name, fee: est.zone.fee ? format(est.zone.fee) : t('checkout.free') }) }}</p>
                    <p class="mt-0.5 text-muted-foreground">
                      @if (est.zone.minOrder) {
                        {{ t('checkout.minOrder', { amount: format(est.zone.minOrder) }) }}
                      }
                      @if (est.zone.minOrder && est.zone.etaMinutes) {
                        ·
                      }
                      @if (est.zone.etaMinutes) {
                        {{ t('checkout.eta', { min: est.zone.etaMinutes }) }}
                      }
                    </p>
                    @if (belowMinimum()) {
                      <p class="mt-1 font-medium text-amber-700 dark:text-amber-400">{{ t('checkout.missingMin', { amount: format(est.zone.minOrder - cart.total()) }) }}</p>
                    }
                  }
                }
                @case ('pending') {
                  <p class="text-muted-foreground">{{ t('checkout.feePending') }}</p>
                }
                @case ('outside') {
                  <p class="font-medium text-rose-600 dark:text-rose-400">{{ t('checkout.outside') }}</p>
                }
                @default {
                  <p class="text-muted-foreground">{{ t('checkout.chooseCommuneFee') }}</p>
                }
              }
            </div>
          </fieldset>
        }

        <!-- 4. Hora -->
        <fieldset>
          <legend class="text-base font-semibold">{{ t('checkout.when') }}</legend>
          <div class="mt-2 grid gap-2">
            @if (m.location.isOpenNow) {
              <label [class]="option">
                <input type="radio" class="size-4 accent-primary" name="carta-when" value="asap" [checked]="when() === 'asap'" (change)="whenChoice.set('asap')" />
                <app-carta-icon name="clock" [size]="20" class="text-muted-foreground" />
                <span class="flex-1">
                  <span class="block font-semibold">{{ t('checkout.asap') }}</span>
                  <span class="block text-xs text-muted-foreground">{{ t('checkout.prep', { min: o.prepMinutes }) }}</span>
                </span>
              </label>
            }
            @if (days().length) {
              <label [class]="option">
                <input type="radio" class="size-4 accent-primary" name="carta-when" value="scheduled" [checked]="when() === 'scheduled'" (change)="whenChoice.set('scheduled')" />
                <app-carta-icon name="calendar" [size]="20" class="text-muted-foreground" />
                <span class="flex-1 font-semibold">{{ t('checkout.schedule') }}</span>
              </label>
            }
          </div>
          @if (when() === 'scheduled' && selectedDay(); as day) {
            <div class="mt-3 grid grid-cols-[1fr_7.5rem] gap-3">
              <div>
                <label for="carta-co-day" class="block text-sm font-semibold">{{ t('checkout.day') }}</label>
                <select id="carta-co-day" [class]="inputClass(null)" (change)="date.set($any($event.target).value)">
                  @for (d of days(); track d.date) {
                    <option [value]="d.date" [selected]="d.date === day.date">{{ d.label }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="carta-co-time" class="block text-sm font-semibold">{{ t('checkout.time') }}</label>
                <select id="carta-co-time" [class]="inputClass('when')" [attr.aria-invalid]="!!errors().when" (change)="slot.set($any($event.target).value)">
                  @for (s of day.slots; track s.iso) {
                    <option [value]="s.iso" [selected]="s.iso === selectedSlot()">{{ s.time }}</option>
                  }
                </select>
              </div>
            </div>
            <p class="mt-1.5 text-xs text-muted-foreground">{{ t('checkout.timeHint', { location: m.location.name, min: o.prepMinutes }) }}</p>
          }
          @if (!m.location.isOpenNow && !days().length) {
            <p class="mt-2 flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-medium" role="note">
              <app-carta-icon name="clock" [size]="16" class="mt-0.5" />
              {{ t('checkout.noSlots') }}
            </p>
          }
          @if (errors().when; as e) {
            <p class="mt-1 text-sm text-rose-600 dark:text-rose-400" role="alert">{{ e }}</p>
          }
        </fieldset>

        <!-- 5. Pago y resumen -->
        <fieldset>
          <legend class="text-base font-semibold">{{ t('checkout.payment') }}</legend>
          <div class="mt-2 grid gap-2" [attr.aria-describedby]="errors().payment ? 'carta-co-payment-error' : null">
            @for (p of methods(); track p) {
              <label [class]="option">
                <input type="radio" class="size-4 accent-primary" name="carta-payment" [value]="p" [checked]="payment() === p" (change)="paymentChoice.set(p)" />
                <app-carta-icon [name]="paymentIcons[p]" [size]="20" class="text-muted-foreground" />
                <span class="flex-1 font-semibold">{{ paymentLabels[p] }}</span>
              </label>
            } @empty {
              <p class="text-sm text-muted-foreground">{{ channel() === 'pickup' ? t('checkout.noMethodsPickup') : t('checkout.noMethodsDelivery') }}</p>
            }
          </div>
          @if (errors().payment; as e) {
            <p id="carta-co-payment-error" class="mt-1 text-sm text-rose-600 dark:text-rose-400">{{ e }}</p>
          }
          @if (payment() === 'transfer_receipt') {
            <p class="mt-2 text-xs text-muted-foreground">{{ t('checkout.transferHint') }}</p>
          }
        </fieldset>

        <div>
          <label for="carta-co-note" class="block text-sm font-semibold">{{ t('cart.noteLabel') }} <span class="font-normal text-muted-foreground">{{ t('cart.optional') }}</span></label>
          <textarea
            id="carta-co-note"
            rows="2"
            class="{{ inputClass(null) }} resize-none"
            [placeholder]="t('checkout.notePlaceholder')"
            [attr.maxlength]="maxNote"
            [value]="cart.note()"
            (input)="cart.setNote($any($event.target).value)"
          ></textarea>
        </div>

        <section aria-labelledby="carta-co-summary" class="rounded-2xl border border-border bg-card px-4 py-3">
          <h3 id="carta-co-summary" class="text-base font-semibold">{{ t('checkout.summary') }}</h3>
          <dl class="mt-2 grid gap-1.5 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-muted-foreground">{{ t('checkout.products', { n: cart.count() }) }}</dt>
              <dd class="font-semibold tabular-nums">{{ format(cart.total()) }}</dd>
            </div>
            @if (channel() === 'delivery') {
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">{{ t('checkout.shipping') }}</dt>
                <dd class="font-semibold tabular-nums">{{ fee() == null ? t('checkout.toConfirm') : fee() ? format(fee()!) : t('checkout.freeCap') }}</dd>
              </div>
            }
            <div class="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <dt class="font-semibold">{{ t('cart.total') }}</dt>
              <dd class="text-lg font-bold tabular-nums">{{ format(cart.total() + (fee() ?? 0)) }}</dd>
            </div>
          </dl>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('cart.totalConfirm') }}</p>
        </section>

        <div class="sticky bottom-0 z-10 -mx-5 -mb-6 border-t border-border bg-background/95 px-5 pb-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          @if (error(); as e) {
            <div class="mb-2 flex items-start gap-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
              <app-carta-icon name="alert" [size]="16" class="mt-0.5" />
              <span class="flex-1">{{ e }}</span>
              @if (cartError()) {
                <button type="button" class="shrink-0 font-semibold text-foreground underline underline-offset-4" (click)="back.emit()">{{ t('checkout.reviewCart') }}</button>
              }
            </div>
          } @else if (cart.hasIssues()) {
            <p class="mb-2 text-center text-xs font-medium text-muted-foreground" role="note">{{ t('checkout.removeMarked') }}</p>
          }
          <button
            type="submit"
            class="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            [disabled]="sending() || !cart.items().length || cart.hasIssues()"
            [attr.aria-busy]="sending() || null"
          >
            @if (sending()) {
              <span class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" aria-hidden="true"></span>
              {{ t('cart.sending') }}
            } @else {
              {{ t('checkout.confirm', { total: format(cart.total() + (fee() ?? 0)) }) }}
            }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class CartaCheckoutSheet {
  readonly menu = input.required<PublicLocationMenuDto>();
  readonly ordered = output<PublicOrderDto>();
  /** Volver al carrito. */
  readonly back = output<void>();
  /** La carta cambió (producto agotado, retiro o delivery desactivado): recargarla. */
  readonly refresh = output<void>();

  protected readonly cart = inject(CartaCart);
  protected readonly t = inject(CartaI18n).t;
  readonly #api = inject(PublicMenuApiService);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  #sub: Subscription | null = null;

  protected readonly limits = ONLINE_LIMITS;
  protected readonly maxNote = MAX_ORDER_NOTE;
  protected readonly option = OPTION;
  protected readonly channelLabels = CHANNEL_LABELS;
  protected readonly paymentLabels = PAYMENT_LABELS;
  protected readonly paymentIcons = PAYMENT_ICONS;
  protected readonly format = formatMenuPrice;

  protected readonly online = computed(() => this.menu().online as PublicOnlineDto);
  protected readonly communes = computed(() => zoneCommunes(this.online()));
  protected readonly hasRadiusZones = computed(() => this.online().deliveryZones.some((z) => !!z.radiusKm));
  /** Delivery necesita al menos una comuna para enviar communeId. */
  protected readonly channels = computed<OnlineChannel[]>(() => {
    const o = this.online();
    const list: OnlineChannel[] = [];
    if (o.pickup) list.push('pickup');
    if (o.delivery && this.communes().length) list.push('delivery');
    return list;
  });

  readonly #channelChoice = signal<OnlineChannel | null>(null);
  protected readonly channel = computed<OnlineChannel>(() => {
    const list = this.channels();
    const choice = this.#channelChoice();
    return choice && list.includes(choice) ? choice : (list[0] ?? 'pickup');
  });

  readonly #customer = inject(CartaCustomer);
  /** Etapa 10: perfil del cliente (si está identificado) o lo recordado en redom-customer. */
  readonly #saved = this.#customer.checkoutDefaults();
  /** Identificado: el pedido va con el correo del perfil (no se edita). */
  protected readonly lockedEmail = this.#customer.profileEmail;
  /** CUSTOMER_EMAIL_MISMATCH: el correo del perfil para ofrecerlo. */
  protected readonly profileEmail = signal<string | null>(null);
  protected readonly name = signal(this.#saved.name);
  protected readonly phone = signal(this.#saved.phone);
  protected readonly email = signal(this.#saved.email);

  protected readonly street = signal('');
  protected readonly number = signal('');
  protected readonly details = signal('');
  protected readonly communeId = signal<number | null>(null);
  protected readonly coords = signal<Readonly<{ latitude: number; longitude: number }> | null>(null);
  protected readonly locate = signal<LocateState>('idle');

  protected readonly zoneEstimate = computed(() =>
    this.channel() === 'delivery' ? estimateZone(this.online(), this.menu().location, this.communeId(), this.coords()) : ({ kind: 'none' } as const),
  );
  /** null: por confirmar. */
  protected readonly fee = computed<number | null>(() => {
    if (this.channel() !== 'delivery') return 0;
    const est = this.zoneEstimate();
    return est.kind === 'zone' ? Number(est.zone.fee) : null;
  });
  protected readonly belowMinimum = computed(() => {
    const est = this.zoneEstimate();
    return est.kind === 'zone' && this.cart.total() < Number(est.zone.minOrder);
  });

  // Hora: "Lo antes posible" (solo abierto ahora) o programada
  readonly #now = signal(Date.now());
  protected readonly days = computed(() => scheduleDays(this.menu().location, this.online().prepMinutes, this.#now()));
  protected readonly whenChoice = signal<'asap' | 'scheduled'>('asap');
  /** Con el local cerrado (también si cerró con la hoja abierta) solo se puede programar. */
  protected readonly when = computed(() => (this.menu().location.isOpenNow ? this.whenChoice() : 'scheduled'));
  protected readonly date = signal<string | null>(null);
  protected readonly slot = signal<string | null>(null);
  protected readonly selectedDay = computed(() => {
    const days = this.days();
    return days.find((d) => d.date === this.date()) ?? days[0] ?? null;
  });
  protected readonly selectedSlot = computed(() => {
    const day = this.selectedDay();
    return day?.slots.find((s) => s.iso === this.slot())?.iso ?? day?.slots[0]?.iso ?? null;
  });

  // Pago
  /** PAYMENT_METHOD_NOT_ACCEPTED: details.accepted reemplaza la lista. */
  readonly #accepted = signal<OnlinePaymentMethod[] | null>(null);
  protected readonly paymentChoice = signal<OnlinePaymentMethod | null>(null);
  protected readonly methods = computed(() => methodsFor(this.#accepted() ?? this.online().paymentMethods, this.channel()));
  protected readonly payment = computed(() => {
    const list = this.methods();
    const choice = this.paymentChoice();
    if (choice && list.includes(choice)) return choice;
    return list.length === 1 ? list[0] : null;
  });

  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly cartError = signal(false);
  protected readonly sending = signal(false);

  protected readonly inputClass = (field: Field | null) => `${INPUT} ${field && this.errors()[field] ? 'border-rose-500' : 'border-border'}`;

  constructor() {
    // Las horas disponibles avanzan con el reloj
    const timer = setInterval(() => this.#now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      this.#sub?.unsubscribe();
    });
  }

  protected useProfileEmail(email: string): void {
    this.email.set(email);
    this.profileEmail.set(null);
    this.errors.update(({ email: _e, ...rest }) => rest);
    this.error.set(null);
  }

  /** "¿No eres tú?": cierra la sesión del cliente y deja el formulario sin sus datos. */
  protected notMe(): void {
    const profile = this.#customer.profile();
    this.#customer.logout();
    this.email.set('');
    if (profile?.name && this.name() === profile.name) this.name.set('');
    if (profile?.phone && this.phone() === profile.phone) this.phone.set('');
    this.profileEmail.set(null);
    setTimeout(() => this.#host.nativeElement.querySelector<HTMLElement>('#carta-co-email')?.focus());
  }

  protected setChannel(channel: OnlineChannel): void {
    this.#channelChoice.set(channel);
    this.errors.update(({ street: _s, commune: _c, payment: _p, ...rest }) => rest);
  }

  protected setCommune(value: string): void {
    const id = Number(value);
    this.communeId.set(Number.isInteger(id) && id > 0 ? id : null);
  }

  protected clearCoords(): void {
    this.coords.set(null);
    this.locate.set('idle');
  }

  protected useLocation(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locate.set('error');
      return;
    }
    this.locate.set('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.coords.set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        this.locate.set('done');
      },
      (err) => this.locate.set(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.sending()) return;
    this.error.set(null);
    this.cartError.set(false);
    const items = this.cart.items();
    if (!items.length || items.length > MAX_CART_LINES || this.cart.hasIssues()) return;

    const m = this.menu();
    const channel = this.channel();
    const errors: Partial<Record<Field, string>> = {};
    const name = this.name().trim();
    if (!name) errors.name = ct('checkout.err.name');
    else if (name.length > ONLINE_LIMITS.name) errors.name = ct('checkout.err.nameMax', { max: ONLINE_LIMITS.name });
    const digits = phoneDigits(this.phone());
    if (digits < ONLINE_LIMITS.minPhoneDigits || digits > ONLINE_LIMITS.maxPhoneDigits) errors.phone = ct('checkout.err.phone');
    const email = this.lockedEmail() ?? this.email().trim();
    if (email && !isEmail(email)) errors.email = ct('checkout.err.email');

    if (channel === 'delivery') {
      if (this.communeId() == null) errors.commune = ct('checkout.err.commune');
      else if (this.zoneEstimate().kind === 'outside') errors.commune = ct('online.error.outside');
      if (!this.street().trim()) errors.street = ct('checkout.err.street');
    }

    let scheduledFor: string | null = null;
    const now = Date.now();
    this.#now.set(now);
    if (this.when() === 'asap') scheduledFor = null;
    else {
      const iso = this.selectedSlot();
      const prep = this.online().prepMinutes;
      if (!iso) errors.when = m.location.isOpenNow ? ct('checkout.err.time') : ct('checkout.err.closedSchedule');
      else if (new Date(iso).getTime() < now + (prep - 1) * 60_000) errors.when = ct('online.error.schedule', { prep });
      else scheduledFor = iso;
    }

    const payment = this.payment();
    if (!payment) errors.payment = ct('checkout.err.payment');

    this.errors.set(errors);
    if (Object.keys(errors).length || !payment) {
      setTimeout(() => this.#host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    const note = this.cart.note().trim().slice(0, MAX_ORDER_NOTE);
    const phone = this.phone().trim();
    const coords = this.coords();
    this.sending.set(true);
    this.#sub?.unsubscribe();
    this.profileEmail.set(null);
    this.#sub = this.#customer
      .withCustomer((headers) =>
        this.#api.createOnlineOrder(
          {
            businessSlug: m.business.slug,
            locationSlug: m.location.slug,
            channel,
            items: items.map(toOrderLine),
            customer: { name, phone, email: email || null },
            ...(channel === 'delivery'
              ? {
                  address: {
                    street: this.street().trim().slice(0, ONLINE_LIMITS.street),
                    ...(this.number().trim() ? { number: this.number().trim().slice(0, ONLINE_LIMITS.number) } : {}),
                    ...(this.details().trim() ? { details: this.details().trim().slice(0, ONLINE_LIMITS.details) } : {}),
                    communeId: this.communeId() as number,
                    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
                  },
                }
              : {}),
            scheduledFor,
            paymentMethod: payment,
            ...(note ? { note } : {}),
          },
          headers,
        ),
      )
      .subscribe({
        next: (order) => {
          this.sending.set(false);
          saveCustomer({ name, phone, email });
          this.cart.ordered(order);
          this.#customer.reloadUsual();
          this.ordered.emit(order);
        },
        error: (e) => {
          this.sending.set(false);
          if (readApiError(e).code === 'CUSTOMER_EMAIL_MISMATCH') {
            const profileEmail = this.#customer.profile()?.email ?? null;
            this.errors.set({ email: cartaErrorMessage(e) });
            this.profileEmail.set(profileEmail && profileEmail !== email ? profileEmail : null);
            setTimeout(() => this.#host.nativeElement.querySelector<HTMLElement>('#carta-co-email')?.focus());
            return;
          }
          const err = readOnlineOrderError(e, channel, scheduledFor != null, this.online().prepMinutes);
          this.error.set(err.message);
          if (err.accepted?.length) this.#accepted.set(err.accepted);
          if (err.cart) {
            this.cartError.set(true);
            if (err.productId != null && err.reason) this.cart.markProduct(err.productId, err.reason);
            else if (err.pack) this.cart.markPackGroup(this.menu(), err.groupId);
          }
          if (err.reload) this.refresh.emit();
        },
      });
  }
}
