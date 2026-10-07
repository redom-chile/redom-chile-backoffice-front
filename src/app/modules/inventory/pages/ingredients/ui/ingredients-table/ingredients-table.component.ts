import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatQuantity, UnitDto } from '../../../../data-access';
import { IngredientDto } from '../../data-access';

@Component({
  selector: 'app-ingredients-table',
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent],
  templateUrl: './ingredients-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientsTableComponent {
  readonly ingredients = input.required<readonly IngredientDto[]>();
  readonly units = input<readonly UnitDto[]>([]);
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly searching = input(false);

  readonly edit = output<IngredientDto>();
  readonly pageChange = output<number>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly #unitsById = computed(() => new Map(this.units().map((unit) => [unit.id, unit])));

  unitName(ingredient: IngredientDto): string {
    const unit = ingredient.unitId ? this.#unitsById().get(ingredient.unitId) : undefined;
    return unit ? `${unit.actualName} (${unit.shortName})` : '—';
  }

  minimum(ingredient: IngredientDto): string {
    if (!Number(ingredient.alertQuantity)) return '—';
    const unit = ingredient.unitId ? this.#unitsById().get(ingredient.unitId) : undefined;
    return formatQuantity(ingredient.alertQuantity, unit?.shortName);
  }
}
