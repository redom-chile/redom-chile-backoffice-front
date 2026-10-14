import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PublicProductDto, PublicTagDto } from '../../data-access/dtos/public-menu.dto';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { isPackUnavailable, packChoiceLabel, promotionLabel } from '../carta-marketing';
import { CartaIcon, CartaTagIcon } from './carta-icon';
import { CartaPrice } from './carta-price';

/**
 * Detalle de un producto (dentro de app-carta-dialog): precios, promoción y, si es pack, su contenido.
 * Informativo: el botón de agregar al pedido llega en la etapa 3.
 */
@Component({
  selector: 'app-carta-product-detail',
  imports: [CartaIcon, CartaTagIcon, CartaPrice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = product();
    @if (p.imageUrl && !imageFailed()) {
      <img [src]="p.imageUrl" alt="" decoding="async" class="h-auto max-h-80 w-full bg-muted object-cover" (error)="imageFailed.set(true)" />
    }
    <div class="px-5 pb-6" [class.pt-14]="!p.imageUrl || imageFailed()" [class.pt-5]="p.imageUrl && !imageFailed()">
      <h2 class="pr-10 text-xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere]" [class.pr-0]="p.imageUrl && !imageFailed()">{{ p.name }}</h2>

      @if (p.soldOut || packUnavailable() || promotion() || p.pack) {
        <div class="mt-2 flex flex-wrap gap-1.5">
          @if (p.soldOut) {
            <span class="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-background">Agotado</span>
          } @else if (packUnavailable()) {
            <span class="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-background">No disponible</span>
          }
          @if (promotion(); as promo) {
            <span class="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              <app-carta-icon name="tag" [size]="13" />
              {{ promo }}
            </span>
          }
          @if (p.pack) {
            <span class="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
              <app-carta-icon name="package" [size]="13" />
              Pack
            </span>
          }
        </div>
      }

      @if (p.description) {
        <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{{ p.description }}</p>
      }

      @if (productTags().length) {
        <ul class="mt-3 flex flex-wrap gap-1.5" aria-label="Etiquetas">
          @for (tag of productTags(); track tag.code) {
            <li class="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <app-carta-tag-icon [icon]="tag.icon" />
              <span>{{ tag.name }}</span>
            </li>
          }
        </ul>
      }

      <!-- Precios -->
      @if (p.variations.length === 1) {
        <p class="mt-4 text-lg font-bold">
          <app-carta-price [price]="p.variations[0].price" [originalPrice]="p.variations[0].originalPrice" />
        </p>
      } @else if (p.variations.length > 1) {
        <ul class="mt-4 divide-y divide-border rounded-2xl border border-border" aria-label="Opciones">
          @for (v of p.variations; track v.id) {
            <li class="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span class="min-w-0 [overflow-wrap:anywhere]">{{ v.name }}</span>
              <span class="shrink-0 font-semibold"><app-carta-price [price]="v.price" [originalPrice]="v.originalPrice" /></span>
            </li>
          }
        </ul>
      }

      <!-- Contenido del pack -->
      @if (p.pack?.groups?.length) {
        <section class="mt-6" aria-labelledby="carta-pack-title">
          <h3 id="carta-pack-title" class="text-base font-semibold">Qué trae el pack</h3>
          <div class="mt-2 grid gap-3">
            @for (g of p.pack!.groups; track g.id) {
              @if (g.items.length === 1) {
                @let item = g.items[0];
                <p class="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-sm" [class.opacity-60]="item.soldOut">
                  <app-carta-icon name="check" [size]="16" class="mt-0.5 text-foreground" />
                  <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    Incluye: <strong class="font-semibold">{{ qty(item.quantity) }}{{ item.name }}</strong>
                    @if (item.extraPrice > 0) {
                      <span class="text-muted-foreground"> (+{{ format(item.extraPrice) }})</span>
                    }
                    @if (item.soldOut) {
                      <span class="text-muted-foreground"> · Agotado</span>
                    }
                  </span>
                </p>
              } @else {
                <fieldset class="rounded-2xl border border-border px-4 py-3" [attr.aria-describedby]="'carta-pack-g-' + g.id">
                  <legend class="sr-only">{{ g.name }}</legend>
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span class="font-semibold [overflow-wrap:anywhere]" aria-hidden="true">{{ g.name }}</span>
                    <span [id]="'carta-pack-g-' + g.id" class="text-xs font-medium text-muted-foreground">{{ choiceLabel(g) }}</span>
                  </div>
                  <ul class="mt-2 grid gap-1">
                    @for (item of g.items; track item.variationId) {
                      <li class="flex items-center gap-3 py-1.5 text-sm" [class.opacity-50]="item.soldOut" [attr.aria-disabled]="item.soldOut || null">
                        <span
                          class="flex size-5 shrink-0 items-center justify-center rounded-full border-2"
                          [class]="item.isDefault && !item.soldOut ? 'border-primary bg-primary text-primary-foreground' : 'border-border'"
                          aria-hidden="true"
                        >
                          @if (item.isDefault && !item.soldOut) {
                            <app-carta-icon name="check" [size]="12" />
                          }
                        </span>
                        <span class="min-w-0 flex-1 [overflow-wrap:anywhere]" [class.line-through]="item.soldOut">
                          {{ qty(item.quantity) }}{{ item.name }}
                          @if (item.isDefault) {
                            <span class="text-xs text-muted-foreground"> · por defecto</span>
                          }
                          @if (item.soldOut) {
                            <span class="sr-only"> (agotado)</span>
                          }
                        </span>
                        @if (item.soldOut) {
                          <span class="shrink-0 text-xs font-medium text-muted-foreground">Agotado</span>
                        } @else if (item.extraPrice > 0) {
                          <span class="shrink-0 font-medium">+{{ format(item.extraPrice) }}</span>
                        }
                      </li>
                    }
                  </ul>
                  @if (requiredWithoutOptions(g)) {
                    <p class="mt-1 text-xs font-medium text-muted-foreground">Sin opciones disponibles por ahora</p>
                  }
                </fieldset>
              }
            }
          </div>
          @if (packUnavailable()) {
            <p class="mt-3 flex items-start gap-2 text-sm text-muted-foreground" role="note">
              <app-carta-icon name="info" [size]="16" class="mt-0.5" />
              Este pack no está disponible en este momento.
            </p>
          }
        </section>
      }
    </div>
  `,
})
export class CartaProductDetail {
  readonly product = input.required<PublicProductDto>();
  readonly tagsByCode = input<ReadonlyMap<string, PublicTagDto>>(new Map());
  readonly timeZone = input('America/Santiago');

  protected readonly imageFailed = signal(false);
  protected readonly format = formatMenuPrice;
  protected readonly choiceLabel = packChoiceLabel;
  protected readonly qty = (quantity: number) => (quantity > 1 ? `${quantity} × ` : '');
  protected readonly requiredWithoutOptions = (g: { minChoices: number; items: readonly { soldOut: boolean }[] }) =>
    g.minChoices > 0 && g.items.every((i) => i.soldOut);

  protected readonly promotion = computed(() => {
    const promo = this.product().promotion;
    return promo ? promotionLabel(promo, this.timeZone()) : null;
  });

  protected readonly packUnavailable = computed(() => !!this.product().pack && isPackUnavailable(this.product().pack!.groups));

  protected readonly productTags = computed(() => {
    const map = this.tagsByCode();
    return this.product()
      .tags.map((code) => map.get(code))
      .filter((tag): tag is PublicTagDto => !!tag);
  });
}
