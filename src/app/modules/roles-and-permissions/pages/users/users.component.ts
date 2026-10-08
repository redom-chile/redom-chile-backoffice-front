import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, CaseTransformDirective } from 'src/ui';
import { GetAllUsersService } from './data-access';
import { CreateUserModalComponent, UsersTableComponent } from './features';
import { MatDialog } from '@angular/material/dialog';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import {
  PLAN_LIMIT_REACHED_TOOLTIP,
  PlanLockedNoticeComponent,
  PlanUsageComponent,
  planLimitGate,
} from 'src/app/shared/components/plan-limit';

@Component({
  selector: 'app-users',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    UsersTableComponent,
    CheckPermissionDirective,
    PlanUsageComponent,
    PlanLockedNoticeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private readonly dialog = inject(MatDialog);
  protected readonly $service = inject(GetAllUsersService);
  private readonly $locationsService = inject(GetAllBusinessLocationsService);

  // Nombre de cada sucursal (la lista de usuarios solo trae branchId).
  protected readonly $branchNames = computed(() =>
    Object.fromEntries((this.$locationsService.$locations() ?? []).map((location) => [location.id, location.name])),
  );

  protected readonly limitGate = planLimitGate('max_users');
  protected readonly limitTooltip = PLAN_LIMIT_REACHED_TOOLTIP;

  page = 1;

  constructor() {
    this.$service.retry();
    this.$locationsService.retry();
  }

  retry() {
    this.$service.retry();
  }

  createUser() {
    if (!this.limitGate.allow()) return;
    this.dialog.open(CreateUserModalComponent, {
      width: '90%',
      data: {},
    });
  }

  onPageChange(page: number) {
    this.page = page;
    this.$service.setParams({ page });
  }

  onPerPageChange(perPage: number) {
    this.$service.setParams({ perPage, page: 1 });
  }

  onSearchNameChange(name: string) {
    this.$service.setParams({ name, page: 1 });
  }
}
