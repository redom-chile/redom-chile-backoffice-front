import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { formatMenuPrice } from '../../data-access/public-menu-format';
import { CartaI18n } from '../carta-i18n';

/** Precio final (ya trae la promoción) y, si hay promoción, el anterior tachado. No recalcula nada. */
@Component({
  selector: 'app-carta-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-wrap items-baseline gap-x-1.5' },
  template: `
    <span>{{ prefix() }}{{ format(price()) }}</span>
    @if (originalPrice() != null) {
      <s class="text-[0.85em] font-normal text-muted-foreground"><span class="sr-only">{{ t('price.before') }}</span>{{ format(originalPrice()!) }}</s>
    }
  `,
})
export class CartaPrice {
  readonly price = input.required<number>();
  readonly originalPrice = input<number | null | undefined>(null);
  /** "desde " */
  readonly prefix = input('');

  protected readonly format = formatMenuPrice;
  protected readonly t = inject(CartaI18n).t;
}
