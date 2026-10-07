import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { FOOD_COST_LEVEL_CLASSES, FoodCostItemDto, foodCostLevel, formatMoney, formatQuantity } from '../../../../data-access';
import { FoodCostSort, FoodCostSortKey } from '../../data-access';

/** Tabla de food cost (tarjetas en móvil). El orden lo decide la página. */
@Component({
  selector: 'app-food-cost-table',
  imports: [NgTemplateOutlet, RouterLink, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './food-cost-table.component.html',
})
export class FoodCostTableComponent {
  readonly items = input.required<readonly FoodCostItemDto[]>();
  readonly loading = input(false);
  readonly hasFilters = input(false);
  readonly sort = input.required<FoodCostSort>();
  // Local de los costos (para el link al kardex).
  readonly locationId = input<number | null>(null);

  readonly sortChange = output<FoodCostSortKey>();
  readonly clearFilters = output<void>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly formatMoney = formatMoney;

  protected percentText(item: FoodCostItemDto): string {
    return item.foodCostPercent === null ? 'Sin precio' : `${formatQuantity(Math.round(item.foodCostPercent * 10) / 10)} %`;
  }

  protected percentClass(item: FoodCostItemDto): string {
    return FOOD_COST_LEVEL_CLASSES[foodCostLevel(item.foodCostPercent)];
  }

  protected isRecipe(item: FoodCostItemDto): boolean {
    return item.stockMode === 'recipe';
  }

  /** Platos → editor de recetas; stock propio → kardex de la variación. */
  protected link(item: FoodCostItemDto): unknown[] {
    return this.isRecipe(item) ? ['/inventory/recipes', item.productId] : ['/inventory/kardex'];
  }

  protected linkParams(item: FoodCostItemDto): Record<string, number> | null {
    if (this.isRecipe(item)) return null;
    const locationId = this.locationId();
    return locationId ? { variationId: item.variationId, locationId } : { variationId: item.variationId };
  }

  protected linkLabel(item: FoodCostItemDto): string {
    return this.isRecipe(item) ? `Ver receta de ${item.itemName}` : `Ver kardex de ${item.itemName}`;
  }

  protected ariaSort(key: FoodCostSortKey): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(key: FoodCostSortKey): string {
    const sort = this.sort();
    if (sort.key !== key) return 'unfold_more';
    return sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }
}
