import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MenuCardStyle } from '../../data-access/dtos/menu-design.dto';
import { PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { CartaI18n } from '../carta-i18n';
import { cheapestVariation, isPackUnavailable, promotionLabel } from '../carta-marketing';
import { CartaIcon, CartaTagIcon } from './carta-icon';
import { CartaPrice } from './carta-price';

/** Producto de la carta (lista, con foto arriba o solo texto): precio o "desde $X" (con el anterior tachado si hay promoción); al tocar, el detalle. Agotado: atenuado, no oculto. */
@Component({
  selector: 'app-carta-product-card',
  imports: [NgTemplateOutlet, CartaIcon, CartaTagIcon, CartaPrice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = product();
    @let v = variant();
    <ng-template #nameRow>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 class="carta-card-name font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{{ p.name }}</h3>
        <ng-container [ngTemplateOutlet]="flags" />
      </div>
    </ng-template>
    <ng-template #flags>
      @if (p.chefNote) {
        <span class="inline-flex text-primary" [title]="t('design.hasChefNote')">
          <app-carta-icon name="chef-hat" [size]="16" />
          <span class="sr-only">{{ t('design.hasChefNote') }}</span>
        </span>
      }
      @if (p.soldOut) {
        <span class="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-background">{{ t('common.soldOut') }}</span>
      } @else if (packUnavailable()) {
        <span class="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-background">{{ t('common.unavailable') }}</span>
      }
    </ng-template>
    <ng-template #details>
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
        <p class="mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]" [class]="compact() ? 'line-clamp-2' : 'line-clamp-3'">{{ p.description }}</p>
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
    </ng-template>
    <ng-template #addPill>
      <!-- Visual: toda la tarjeta abre el detalle, donde se agrega -->
      <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm" aria-hidden="true">
        <app-carta-icon name="plus" [size]="14" />
        {{ t('common.add') }}
      </span>
    </ng-template>
    <ng-template #priceRow>
      @if (cheapest() || orderable()) {
        <div class="mt-2 flex items-center justify-between gap-2" [class.flex-wrap]="compact()">
          @if (cheapest(); as c) {
            <p class="text-[0.9375rem] font-semibold text-foreground">
              <app-carta-price [price]="c.price" [originalPrice]="c.originalPrice" [prefix]="samePrice() ? '' : t('product.from')" />
            </p>
          }
          @if (orderable()) {
            <ng-container [ngTemplateOutlet]="addPill" />
          }
        </div>
      }
    </ng-template>

    <article
      class="carta-card relative overflow-hidden rounded-2xl border border-border bg-card transition focus-within:ring-2 focus-within:ring-primary hover:border-foreground/20"
      [class.opacity-60]="dimmed()"
      [class.h-full]="v === 'photo'"
      [attr.data-variant]="v"
    >
      @switch (v) {
        @case ('photo') {
          @if (p.imageUrl && !imageFailed()) {
            <img
              [src]="p.imageUrl"
              alt=""
              loading="lazy"
              decoding="async"
              class="carta-card-photo w-full bg-muted object-cover"
              [class]="compact() ? 'aspect-square' : 'aspect-[4/3]'"
              (error)="imageFailed.set(true)"
            />
          } @else if (compact()) {
            <span class="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground" aria-hidden="true">
              <app-carta-icon name="utensils" [size]="28" />
            </span>
          }
          <div class="carta-card-body" [class]="compact() ? 'p-2.5' : 'p-3 sm:p-4'">
            <ng-container [ngTemplateOutlet]="nameRow" />
            <ng-container [ngTemplateOutlet]="details" />
            <ng-container [ngTemplateOutlet]="priceRow" />
          </div>
        }
        @case ('text') {
          <div class="carta-card-body p-3 sm:p-4">
            <div class="flex items-baseline gap-2">
              <h3 class="carta-card-name min-w-0 font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{{ p.name }}</h3>
              <span class="carta-leader" aria-hidden="true"></span>
              @if (cheapest(); as c) {
                <p class="shrink-0 text-[0.9375rem] font-semibold text-foreground">
                  <app-carta-price [price]="c.price" [originalPrice]="c.originalPrice" [prefix]="samePrice() ? '' : t('product.from')" />
                </p>
              }
            </div>
            @if (p.chefNote || p.soldOut || packUnavailable()) {
              <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <ng-container [ngTemplateOutlet]="flags" />
              </div>
            }
            <ng-container [ngTemplateOutlet]="details" />
            @if (orderable()) {
              <div class="mt-2 flex justify-end">
                <ng-container [ngTemplateOutlet]="addPill" />
              </div>
            }
          </div>
        }
        @default {
          <div class="carta-card-body flex gap-3 p-3 sm:p-4">
            <div class="min-w-0 flex-1">
              <ng-container [ngTemplateOutlet]="nameRow" />
              <ng-container [ngTemplateOutlet]="details" />
              <ng-container [ngTemplateOutlet]="priceRow" />
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
        }
      }
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
  /** Etapa 8: list (la de siempre), photo (foto arriba) o text (sin foto, precio con puntos guía). */
  readonly variant = input<MenuCardStyle>('list');
  /** Foto en una grilla de 2 o 3 columnas: foto cuadrada (o un marcador sin foto) y textos más cortos. */
  readonly compact = input(false);
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
