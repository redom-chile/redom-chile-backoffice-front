import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { CartaI18n } from '../carta-i18n';
import { cheapestVariation, isPackUnavailable, promotionLabel } from '../carta-marketing';
import { CartaIcon, CartaTagIcon } from './carta-icon';
import { CartaPrice } from './carta-price';

/** Producto de la carta: precio o "desde $X" (con el anterior tachado si hay promoción); al tocar, el detalle. Agotado: atenuado, no oculto. */
@Component({
  selector: 'app-carta-product-card',
  imports: [CartaIcon, CartaTagIcon, CartaPrice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = product();
    <article
      class="relative overflow-hidden rounded-2xl border border-border bg-card transition focus-within:ring-2 focus-within:ring-primary hover:border-foreground/20"
      [class.opacity-60]="dimmed()"
    >
      <div class="flex gap-3 p-3 sm:p-4">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 class="font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{{ p.name }}</h3>
            @if (p.soldOut) {
              <span class="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-background">{{ t('common.soldOut') }}</span>
            } @else if (packUnavailable()) {
              <span class="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-background">{{ t('common.unavailable') }}</span>
            }
          </div>
          @if (promotion() || p.pack) {
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              @if (promotion(); as promo) {
                <span class="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">
                  <app-carta-icon name="tag" [size]="12" />
                  {{ promo }}
                </span>
              }
              @if (p.pack) {
                <span class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[0.6875rem] font-semibold text-foreground">
                  <app-carta-icon name="package" [size]="12" />
                  {{ t('common.pack') }}
                </span>
              }
            </div>
          }
          @if (p.description) {
            <p class="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ p.description }}</p>
          }
          @if (productTags().length) {
            <ul class="mt-2 flex flex-wrap gap-1.5" [attr.aria-label]="t('common.tags')">
              @for (tag of productTags(); track tag.code) {
                <li
                  class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground"
                  [title]="tag.name"
                >
                  <app-carta-tag-icon [icon]="tag.icon" />
                  <span>{{ tag.name }}</span>
                </li>
              }
            </ul>
          }
          @if (cheapest() || orderable()) {
            <div class="mt-2 flex items-center justify-between gap-2">
              @if (cheapest(); as v) {
                <p class="text-[0.9375rem] font-semibold text-foreground">
                  <app-carta-price [price]="v.price" [originalPrice]="v.originalPrice" [prefix]="samePrice() ? '' : t('product.from')" />
                </p>
              }
              @if (orderable()) {
                <!-- Visual: toda la tarjeta abre el detalle, donde se agrega -->
                <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm" aria-hidden="true">
                  <app-carta-icon name="plus" [size]="14" />
                  {{ t('common.add') }}
                </span>
              }
            </div>
          }
        </div>
        @if (p.imageUrl && !imageFailed()) {
          <img
            [src]="p.imageUrl"
            alt=""
            loading="lazy"
            decoding="async"
            width="96"
            height="96"
            class="size-24 shrink-0 rounded-xl bg-muted object-cover sm:size-28"
            (error)="imageFailed.set(true)"
          />
        }
      </div>
      <!-- Toda la tarjeta abre el detalle -->
      <button type="button" class="absolute inset-0 size-full cursor-pointer rounded-2xl outline-none" (click)="view.emit(p)">
        <span class="sr-only">{{ t(orderable() ? 'product.viewAdd' : 'product.viewDetail', { name: p.name }) }}</span>
      </button>
    </article>
  `,
})
export class CartaProductCard {
  readonly product = input.required<PublicProductDto>();
  /** Etiquetas de la carta por código. */
  readonly tagsByCode = input<ReadonlyMap<string, PublicTagDto>>(new Map());
  /** Zona horaria del local (fecha de fin de la promoción). */
  readonly timeZone = input('America/Santiago');
  /** Pedidos desde la mesa y el producto se puede agregar: muestra "Agregar". */
  readonly orderable = input(false);
  readonly view = output<PublicProductDto>();

  protected readonly t = inject(CartaI18n).t;
  protected readonly imageFailed = signal(false);

  protected readonly cheapest = computed(() => cheapestVariation(this.product()));
  protected readonly samePrice = computed(() => {
    const prices = this.product().variations.map((v) => v.price);
    return prices.every((price) => price === prices[0]);
  });

  protected readonly promotion = computed(() => {
    const promo = this.product().promotion;
    return promo ? promotionLabel(promo, this.timeZone()) : null;
  });

  protected readonly packUnavailable = computed(() => !!this.product().pack && isPackUnavailable(this.product().pack!.groups));
  protected readonly dimmed = computed(() => this.product().soldOut || this.packUnavailable());

  protected readonly productTags = computed(() => {
    const map = this.tagsByCode();
    return this.product()
      .tags.map((code) => map.get(code))
      .filter((tag): tag is PublicTagDto => !!tag);
  });
}
