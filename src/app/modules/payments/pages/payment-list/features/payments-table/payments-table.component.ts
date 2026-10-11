import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatCurrency, formatDateTime } from 'src/app/modules/orders/pages/order-list/ui';
import { PaymentDto } from '../../data-access';
import { paymentLinesLabel, paymentMethodIcon, paymentMethodLabel } from '../../ui';

@Component({
  selector: 'app-payments-table',
  standalone: true,
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent],
  templateUrl: './payments-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsTableComponent {
  readonly payments = input.required<PaymentDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly hasFilters = input(false);
  // En el detalle del pedido no se repite la columna "Pedido".
  readonly showOrder = input(true);
  readonly canVoid = input(true);

  private readonly access = inject(AccessService);
  // Anular también exige el permiso del rol.
  readonly $canVoid = computed(() => this.canVoid() && this.access.can(PERMISSIONS.PAYMENTS.CANCEL_PAYMENT));

  readonly voidPayment = output<PaymentDto>();
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly formatCurrency = formatCurrency;
  readonly formatDateTime = formatDateTime;
  readonly methodLabel = paymentMethodLabel;
  readonly methodIcon = paymentMethodIcon;
  readonly linesLabel = paymentLinesLabel;
}
