import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CartaI18n } from '../carta-i18n';
import { cheapestVariation } from '../carta-marketing';
import { CartaSuggestions, needsDetail } from '../carta-suggestions';
import { CartaIcon } from './carta-icon';
import { CartaPrice } from './carta-price';

/** Etapa 11: "Completa tu pedido" en el carrito y en el pago. Sin sugerencias no ocupa espacio. */
@Component({
  selector: 'app-carta-suggestions-list',
  imports: [CartaIcon, CartaPrice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block empty:hidden' },
  template: `
    @if (items().length) {
      <section aria-labelledby="carta-suggestions-title">
        <h3 id="carta-suggestions-title" class="flex items-center gap-1.5 text-base font-semibold">
          <app-carta-icon name="sparkles" [size]="16" class="text-primary" />
          {{ t('dynamic.suggestions') }}
        </h3>
        @if (!anyMessage()) {
          <p class="mt-0.5 text-sm text-muted-foreground">{{ t('dynamic.suggestionDefault') }}</p>
        }
        <ul class="-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          @for (s of items(); track s.product.id) {
            @let p = s.product;
            <li class="flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card">
              @if (p.imageUrl) {
                <img [src]="p.imageUrl" alt="" loading="lazy" decoding="async" class="aspect-[4/3] w-full bg-muted object-cover" />
              }
              <div class="flex flex-1 flex-col gap-1 p-2.5">
                @if (s.message) {
                  <p class="line-clamp-2 text-xs font-medium text-primary [overflow-wrap:anywhere]">{{ s.message }}</p>
                }
                <p class="line-clamp-2 text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{{ p.name }}</p>
                @if (cheapest(p); as v) {
                  <span class="text-sm font-semibold"><app-carta-price [price]="v.price" [originalPrice]="v.originalPrice" [prefix]="p.variations.length > 1 ? t('product.from') : ''" /></span>
                }
                <button
                  type="button"
                  class="mt-auto inline-flex min-h-9 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                  [class]="detailNeeded(p) ? 'border border-border bg-background text-foreground hover:bg-muted' : 'bg-primary text-primary-foreground shadow-sm'"
                  [attr.aria-label]="t(detailNeeded(p) ? 'dynamic.chooseNamed' : 'dynamic.addNamed', { name: p.name })"
                  (click)="suggestions.choose(p)"
                >
                  @if (detailNeeded(p)) {
                    {{ t('dynamic.choose') }}
                    <app-carta-icon name="chevron-right" [size]="14" />
                  } @else {
                    <app-carta-icon name="plus" [size]="14" />
                    {{ t('common.add') }}
                  }
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class CartaSuggestionsList {
  protected readonly suggestions = inject(CartaSuggestions);
  protected readonly t = inject(CartaI18n).t;
  protected readonly items = this.suggestions.suggestions;
  protected readonly anyMessage = computed(() => this.items().some((s) => !!s.message));
  protected readonly cheapest = cheapestVariation;
  protected readonly detailNeeded = needsDetail;

  constructor() {
    effect(() => {
      const ids = this.items().map((s) => s.product.id);
      untracked(() => ids.forEach((id) => this.suggestions.shown(id)));
    });
  }
}
