import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { PaginationTableComponent, SkeletonComponent } from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  formatSignedQuantity,
  formatUnitCost,
  MOVEMENT_TYPE_LABELS,
  StockMovementDto,
} from '../../../data-access';
import { formatDateTimeFull, variationLabel } from '../../data-access';

/** Movimientos de stock (kardex y detalle de documento). En móvil se muestran tarjetas. */
@Component({
  selector: 'app-movements-table',
  imports: [RouterLink, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movements-table.component.html',
})
export class MovementsTableComponent {
  readonly movements = input.required<readonly StockMovementDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly hasFilters = input(false);
  // En el detalle de un documento no se repiten local ni documento.
  readonly showLocation = input(true);
  readonly showDocument = input(true);
  readonly emptyText = input('Todavía no hay movimientos de stock.');
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  readonly typeLabels = MOVEMENT_TYPE_LABELS;
  readonly formatMoney = formatMoney;
  readonly formatUnitCost = formatUnitCost;
  readonly formatQuantity = formatQuantity;
  readonly formatSignedQuantity = formatSignedQuantity;
  readonly formatDateTime = formatDateTimeFull;
  readonly variationLabel = variationLabel;

  quantityTone(quantity: number): string {
    return quantity > 0 ? 'text-green-600' : quantity < 0 ? 'text-red-600' : 'text-muted-foreground';
  }
}
