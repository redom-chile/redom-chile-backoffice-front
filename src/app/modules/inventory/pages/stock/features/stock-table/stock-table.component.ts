import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatMoney, formatQuantity, formatUnitCost, StockItemDto } from '../../../../data-access';
import { daysUntil, DEFAULT_EXPIRY_DAYS, expiryDistanceLabel, formatShortDate, variationLabel, wasteLinkParams } from '../../../../shared';

type ExpiryBadge = Readonly<{ text: string; title: string; tone: string }>;

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

  /** "Vence el 09/10": ámbar si vence dentro de 7 días, rojo si ya pasó. */
  expiryBadge(item: StockItemDto): ExpiryBadge | null {
    if (!item.nextExpiryDate) return null;
    const days = daysUntil(item.nextExpiryDate);
    const tone =
      days !== null && days < 0
        ? 'bg-red-500/15 text-red-700 dark:text-red-400'
        : days !== null && days <= DEFAULT_EXPIRY_DAYS
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
          : 'bg-muted text-muted-foreground';
    const prefix = days !== null && days < 0 ? 'Venció el' : 'Vence el';
    return {
      text: `${prefix} ${formatShortDate(item.nextExpiryDate)}`,
      title: `Lote que vence antes: ${expiryDistanceLabel(days)}`,
      tone,
    };
  }

  expiredQuantity(item: StockItemDto): number {
    return Number(item.expiredQuantity ?? 0);
  }

  wasteParams(item: StockItemDto) {
    return wasteLinkParams(item.variationId, this.locationId());
  }

  lotsParams(item: StockItemDto) {
    return { variationId: item.variationId, locationId: this.locationId() ?? undefined };
  }

  linkParams(item: StockItemDto) {
    return { variationId: item.variationId, locationId: this.locationId() ?? undefined };
  }
}
