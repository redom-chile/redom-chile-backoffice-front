import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaIcon, CartaTagIcon } from './carta-icon';

/** Producto de la carta: precio o "desde $X"; al tocar, las variaciones. Agotado: atenuado, no oculto. */
@Component({
  selector: 'app-carta-product-card',
  imports: [CartaIcon, CartaTagIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = product();
    <article
      class="overflow-hidden rounded-2xl border border-border bg-card transition"
      [class.opacity-60]="p.soldOut"
    >
      <div class="flex gap-3 p-3 sm:p-4" [class.cursor-pointer]="hasVariations()" (click)="toggle()">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 class="font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">{{ p.name }}</h3>
            @if (p.soldOut) {
              <span class="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-background">Agotado</span>
            }
          </div>
          @if (p.description) {
            <p class="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ p.description }}</p>
          }
          @if (productTags().length) {
            <ul class="mt-2 flex flex-wrap gap-1.5" aria-label="Etiquetas">
              @for (tag of productTags(); track tag.code) {
                <li
                  class="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  [title]="tag.name"
                >
                  <app-carta-tag-icon [icon]="tag.icon" />
                  <span>{{ tag.name }}</span>
                </li>
              }
            </ul>
          }
          <div class="mt-2 text-[15px] font-semibold text-foreground">
            @if (hasVariations()) {
              <button
                type="button"
                class="-mx-1 inline-flex items-center gap-1.5 rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-primary"
                [attr.aria-expanded]="open()"
                [attr.aria-controls]="'carta-variations-' + p.id"
                (click)="$event.stopPropagation(); toggle()"
              >
                <span>{{ priceLabel() }}</span>
                <span class="text-muted-foreground transition-transform duration-200" [class.rotate-180]="open()">
                  <app-carta-icon name="chevron-down" [size]="16" />
                </span>
                <span class="sr-only">{{ open() ? 'Ocultar opciones' : 'Ver opciones' }}</span>
              </button>
            } @else if (priceLabel(); as price) {
              <span>{{ price }}</span>
            }
          </div>
        </div>
        @if (p.imageUrl && !imageFailed()) {
          <img
            [src]="p.imageUrl"
            [alt]="p.name"
            loading="lazy"
            decoding="async"
            width="96"
            height="96"
            class="size-24 shrink-0 rounded-xl bg-muted object-cover sm:size-28"
            (error)="imageFailed.set(true)"
          />
        }
      </div>
      @if (hasVariations() && open()) {
        <ul [id]="'carta-variations-' + p.id" class="divide-y divide-border border-t border-border px-3 sm:px-4">
          @for (v of p.variations; track v.id) {
            <li class="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span class="min-w-0 text-foreground [overflow-wrap:anywhere]">{{ v.name }}</span>
              <span class="shrink-0 font-semibold text-foreground">{{ format(v.price) }}</span>
            </li>
          }
        </ul>
      }
    </article>
  `,
})
export class CartaProductCard {
  readonly product = input.required<PublicProductDto>();
  /** Etiquetas de la carta por código. */
  readonly tagsByCode = input<ReadonlyMap<string, PublicTagDto>>(new Map());

  protected readonly open = signal(false);
  protected readonly imageFailed = signal(false);
  protected readonly format = formatMenuPrice;

  protected readonly hasVariations = computed(() => this.product().variations.length > 1);

  protected readonly priceLabel = computed(() => {
    const prices = this.product().variations.map((v) => v.price);
    if (!prices.length) return null;
    const min = Math.min(...prices);
    const allSame = prices.every((price) => price === min);
    return allSame ? formatMenuPrice(min) : `desde ${formatMenuPrice(min)}`;
  });

  protected readonly productTags = computed(() => {
    const map = this.tagsByCode();
    return this.product()
      .tags.map((code) => map.get(code))
      .filter((tag): tag is PublicTagDto => !!tag);
  });

  protected toggle(): void {
    if (this.hasVariations()) this.open.update((v) => !v);
  }
}
