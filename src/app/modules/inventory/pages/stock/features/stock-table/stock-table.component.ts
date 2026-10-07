import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatMoney, formatQuantity, formatUnitCost, StockItemDto } from '../../../../data-access';
import { variationLabel } from '../../../../shared';

/** Stock por producto en el local elegido. En móvil se muestran tarjetas. */
@Component({
  selector: 'app-stock-table',
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-table.component.html',
})
export class StockTableComponent {
  readonly items = input.required<readonly StockItemDto[]>();
  readonly locationId = input.required<number | null>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly hasFilters = input(false);
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly formatMoney = formatMoney;
  readonly formatQuantity = formatQuantity;
  readonly variationLabel = variationLabel;

  /** Suma del valor de los ítems visibles (el backend no entrega el total del local). */
  readonly $pageValue = computed(() => this.items().reduce((total, item) => total + Number(item.stockValue ?? 0), 0));

  /** "$9 / g": costo promedio por unidad base. */
  unitCost(item: StockItemDto): string {
    const cost = formatUnitCost(item.avgCost);
    return item.unitName ? `${cost} / ${item.unitName}` : cost;
  }

  linkParams(item: StockItemDto) {
    return { variationId: item.variationId, locationId: this.locationId() ?? undefined };
  }
}
