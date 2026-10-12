import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { GetAllUsersWithRolesService } from './data-access';
import { RolesUserTableComponent } from './features';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-roles-user',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    RolesUserTableComponent,
    CheckPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './roles-user.component.html',
})
export class RolesUserComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly $service = inject(GetAllUsersWithRolesService);

  page = 1;

  constructor() {
    this.$service.retry();
  }

  retry() {
    this.$service.retry();
  }

  onPageChange(page: number) {
    this.page = page;
    this.$service.setParams({ page });
  }

  onPerPageChange(perPage: number) {
    this.$service.setParams({ perPage, page: 1 });
  }

  onSearchFullNameChange(fullName: string) {
    this.$service.setParams({ fullName, page: 1 });
  }
}
