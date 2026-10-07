import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent, IconComponent } from 'src/ui';
import { ModifierSetDto } from '../../data-access';
import { formatModifierPrice } from '../modifier-price';

// Cuántos productos vinculados se nombran antes de resumir con "y N más".
const VISIBLE_PRODUCTS = 4;

@Component({
  selector: 'app-modifier-set-card',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './modifier-set-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModifierSetCardComponent {
  readonly set = input.required<ModifierSetDto>();
  readonly edit = output<ModifierSetDto>();
  readonly products = output<ModifierSetDto>();
  readonly delete = output<ModifierSetDto>();

  readonly formatPrice = formatModifierPrice;

  readonly $productsLabel = computed(() => {
    const products = this.set().modifierProducts;
    const names = products.slice(0, VISIBLE_PRODUCTS).map((product) => product.name).join(', ');
    const rest = products.length - VISIBLE_PRODUCTS;
    return rest > 0 ? `${names} y ${rest} más` : names;
  });
}
