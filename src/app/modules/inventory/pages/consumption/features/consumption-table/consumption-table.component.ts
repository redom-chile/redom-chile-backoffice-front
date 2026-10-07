import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { ConsumptionItemDto, formatMoney, formatQuantity, formatSignedQuantity } from '../../../../data-access';
import { ConsumptionSort, ConsumptionSortKey, SORT_OPTIONS, sortItems } from '../../data-access';

/** Tabla del consumo por ítem (en móvil, tarjetas con detalle plegable). Cada fila lleva a su kardex del período. */
@Component({
  selector: 'app-consumption-table',
  imports: [RouterLink, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consumption-table.component.html',
})
export class ConsumptionTableComponent {
  readonly items = input.required<readonly ConsumptionItemDto[]>();
  readonly loading = input(false);
  readonly sort = input.required<ConsumptionSort>();
  readonly locationId = input.required<number>();
  readonly dateFrom = input<string | null>(null);
  readonly dateTo = input<string | null>(null);
  readonly sortChange = output<ConsumptionSortKey>();
  readonly sortSelect = output<ConsumptionSort>();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly sortOptions = SORT_OPTIONS;
  readonly formatMoney = formatMoney;
  readonly formatQuantity = formatQuantity;
  readonly formatSignedQuantity = formatSignedQuantity;

  readonly $rows = computed(() => sortItems(this.items(), this.sort()));

  kardexParams(item: ConsumptionItemDto) {
    return { variationId: item.variationId, locationId: this.locationId(), from: this.dateFrom() ?? undefined, to: this.dateTo() ?? undefined };
  }

  ariaSort(key: ConsumptionSortKey): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  sortIcon(key: ConsumptionSortKey): string {
    const sort = this.sort();
    if (sort.key !== key) return 'unfold_more';
    return sort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  /** Variación > 0 = pérdida. */
  varianceClass(value: number): string {
    if (value > 0) return 'text-red-600';
    if (value < 0) return 'text-green-600';
    return 'text-muted-foreground';
  }

  /** Diferencia de conteo < 0 = faltante. */
  countClass(value: number): string {
    if (value < 0) return 'text-red-600';
    if (value > 0) return 'text-green-600';
    return 'text-muted-foreground';
  }

  onSortSelect(event: Event) {
    const [key, direction] = (event.target as HTMLSelectElement).value.split(':') as [ConsumptionSortKey, 'asc' | 'desc'];
    this.sortSelect.emit({ key, direction });
  }
}
