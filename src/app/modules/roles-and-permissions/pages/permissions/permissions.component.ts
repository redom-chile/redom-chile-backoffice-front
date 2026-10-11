import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { GetAllPermissionsService } from './data-access';
import { FiltersTablePermissionComponent } from './ui';
import { CreateNewPermissionModalComponent } from './features';
import { MatDialog } from '@angular/material/dialog';
import { PermissionsListComponent } from './features/permissions-list';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-permissions',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    FiltersTablePermissionComponent,
    PermissionsListComponent,
    CheckPermissionDirective,
  ],
  templateUrl: './permissions.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './permissions.component.css',
})
export class PermissionsComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  protected readonly $service = inject(GetAllPermissionsService);

  currentSearchCode = '';
  currentSearchName = '';

  constructor() {
    this.$service.retry();
  }

  retry() {
    this.$service.retry();
  }

  onSearchCodeChange(value: string) {
    this.currentSearchCode = value;
    if (value.length === 0 || value.length >= 3) {
      this.$service.setParams({ searchCode: value });
    }
  }

  onSearchNameChange(value: string) {
    this.currentSearchName = value;
    if (value.length === 0 || value.length >= 3) {
      this.$service.setParams({ searchName: value });
    }
  }

  createNewPermission() {
    this.dialog.open(CreateNewPermissionModalComponent, {
      width: '90%',
      data: {},
    });
  }
}
