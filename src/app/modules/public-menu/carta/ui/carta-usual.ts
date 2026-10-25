import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CustomerUsualDto } from '../../data-access/dtos/customer-profiles.dto';
import { PublicProductDto } from '../../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaI18n, cartaLocale } from '../carta-i18n';
import { CartaIcon } from './carta-icon';

export type UsualOrder = CustomerUsualDto['lastOrders'][number];

/** Etapa 10: "Lo de siempre" del cliente identificado: favoritos (los disponibles primero) y últimos pedidos. */
@Component({
  selector: 'app-carta-usual',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="pt-4" aria-labelledby="carta-usual">
      <h2 id="carta-usual" class="flex items-center gap-2 text-xl font-bold tracking-tight">
        <app-carta-icon name="repeat" [size]="20" class="text-primary" />
        {{ t('customer.usual') }}
      </h2>
      @if (favorites().length) {
        <h3 class="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('customer.favorites') }}</h3>
        <ul class="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          @for (f of favorites(); track f.key) {
            <li class="w-36 shrink-0 snap-start sm:w-40">
              <button
                type="button"
                class="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-primary"
                [class.opacity-60]="!!f.reason"
                [disabled]="!f.product"
                (click)="f.product && open.emit(f.product)"
              >
                @if (f.product?.imageUrl; as src) {
                  <img [src]="src" alt="" loading="lazy" decoding="async" class="aspect-[4/3] w-full bg-muted object-cover" [class.grayscale]="!!f.reason" />
                } @else {
                  <span class="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground" aria-hidden="true">
                    <app-carta-icon name="star" [size]="24" />
                  </span>
                }
                <span class="flex flex-1 flex-col gap-1 p-2.5">
                  <span class="line-clamp-2 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{{ f.name }}</span>
                  @if (f.reason) {
                    <span class="mt-auto text-xs font-medium text-muted-foreground">{{ f.reason }}</span>
                  } @else if (f.price !== null) {
                    <span class="mt-auto text-sm font-semibold tabular-nums">{{ format(f.price) }}</span>
                  }
                </span>
              </button>
            </li>
          }
        </ul>
      }
      @if (usual().lastOrders.length) {
        <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('customer.lastOrders') }}</h3>
        <ul class="mt-2 grid gap-2">
          @for (o of usual().lastOrders; track o.id) {
            <li class="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">
                  {{ date(o.createdAt) }} · <span class="tabular-nums">{{ format(o.total) }}</span>
                </p>
                <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  @for (i of o.items; track $index) {
                    @let off = !isAvailable(i);
                    <span [class.line-through]="off" [class.opacity-60]="off">{{ i.quantity > 1 ? i.quantity + ' × ' + i.name : i.name }}</span>
                    @if (off) {
                      <span class="sr-only">({{ t('customer.unavailable') }})</span>
                    }
                    @if (!$last) {<span>, </span>}
                  }
                </p>
              </div>
              @if (canOrder() && hasAvailable(o)) {
                <button
                  type="button"
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  (click)="repeat.emit(o)"
                >
                  <app-carta-icon name="repeat" [size]="14" />
                  {{ t('customer.repeat') }}
                </button>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class CartaUsual {
  readonly usual = input.required<CustomerUsualDto>();
  readonly products = input.required<ReadonlyMap<number, PublicProductDto>>();
  /** Motivo por el que un producto de la carta no se puede pedir ahora (null: disponible). */
  readonly blockedLabel = input<(p: PublicProductDto) => string | null>(() => null);
  readonly canOrder = input(false);
  readonly open = output<PublicProductDto>();
  readonly repeat = output<UsualOrder>();

  readonly #i18n = inject(CartaI18n);
  protected readonly t = this.#i18n.t;
  protected readonly format = formatMenuPrice;

  protected readonly favorites = computed(() => {
    const byId = this.products();
    const blocked = this.blockedLabel();
    return this.usual()
      .favorites.map((f) => {
        const product = byId.get(f.productId) ?? null;
        const reason = !product ? this.t('customer.unavailable') : (blocked(product) ?? (f.available ? null : this.t('customer.unavailable')));
        return { key: `${f.productId}-${f.variationId}`, name: product?.name ?? f.name, price: f.price, product, reason };
      })
      .sort((a, b) => Number(!!a.reason) - Number(!!b.reason));
  });

  /** Se puede pedir ahora: el servidor lo marca disponible, está en la carta y no está bloqueado (agotado, fuera de horario). */
  protected readonly isAvailable = (i: UsualOrder['items'][number]) => {
    const product = this.products().get(i.productId);
    return i.available && !!product && !this.blockedLabel()(product);
  };
  protected readonly hasAvailable = (o: UsualOrder) => o.items.some(this.isAvailable);

  protected date(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(cartaLocale(), { day: 'numeric', month: 'short' }).format(d);
  }
}
