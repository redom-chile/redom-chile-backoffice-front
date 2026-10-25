import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { formatDateTime } from 'src/app/modules/orders/pages/order-list/ui';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { CustomerListItemDto } from '../../data-access';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-customers-table',
  standalone: true,
  imports: [RouterLink, MatTooltipModule, IconComponent, SkeletonComponent, PaginationTableComponent, CheckPermissionDirective],
  templateUrl: './customers-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersTableComponent {
  protected readonly PERMISSIONS = PERMISSIONS;

  readonly customers = input.required<CustomerListItemDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly searching = input(false);

  readonly pageChange = output<number>();
  readonly create = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];

  verifiedLabel(verifiedAt: string | null | undefined): string {
    return verifiedAt ? `Verificado en la carta el ${formatDateTime(verifiedAt)}` : 'Verificado en la carta';
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }
}
