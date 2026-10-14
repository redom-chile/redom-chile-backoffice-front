import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from 'src/ui';
import { formatCurrency, KITCHEN_STATUS, StatusBadgeComponent } from '../../../order-list/ui';
import { formatQuantity } from 'src/app/modules/payments/pages/payment-list/ui';
import { isPackLine, linePaidState, modifierLabel, OrderLineDto, orderVariationLabel, packItemLabel } from '../../data-access';

@Component({
  selector: 'app-order-lines-table',
  standalone: true,
  imports: [IconComponent, StatusBadgeComponent],
  templateUrl: './order-lines-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderLinesTableComponent {
  readonly lines = input.required<OrderLineDto[]>();
  readonly canServe = input(false);
  readonly showKitchenStatus = input(true);
  readonly pendingLineId = input<number | null>(null);

  // lineId de la línea (o del producto de un pack) a marcar como servida.
  readonly serveLine = output<number>();

  readonly kitchenStatus = KITCHEN_STATUS;
  readonly formatCurrency = formatCurrency;

  readonly modifierLabel = modifierLabel;
  readonly packItemLabel = packItemLabel;
  readonly isPackLine = isPackLine;
  readonly paidState = linePaidState;
  readonly formatQuantity = formatQuantity;

  variationLabel(line: OrderLineDto): string | null {
    return orderVariationLabel(line.variationName);
  }
}
