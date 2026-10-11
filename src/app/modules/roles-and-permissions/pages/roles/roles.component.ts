import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { GetAllRolesService } from './data-access';
import { CreateNewRoleModalComponent, RolesTableComponent } from './features';
import { MatDialog } from '@angular/material/dialog';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-roles',
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, RolesTableComponent, CheckPermissionDirective],
  templateUrl: './roles.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './roles.component.css',
})
export class RolesComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  protected readonly $getAllRolesService = inject(GetAllRolesService);

  page = 1;
  currentSearchCode = '';
  currentSearchName = '';

  constructor() {
    this.changeData();
  }

  // El servicio es compartido (selectores de rol piden 50): al entrar se vuelve a la vista paginada.
  changeData() {
    this.$getAllRolesService.setParams({ page: 1, perPage: 10, searchCode: '', searchName: '' });
  }

  retry() {
    this.$getAllRolesService.retry();
  }

  onPageChange(page: number) {
    this.page = page;
    this.$getAllRolesService.setParams({ page });
  }

  onPerPageChange(perPage: number) {
    this.$getAllRolesService.setParams({ perPage, page: 1 });
  }

  onFiltersChange(filters: { code: string; name: string }) {
    const { code, name } = filters;

    this.currentSearchCode = code;
    this.currentSearchName = name;

    const validCode = code.length === 0 || code.length >= 3;
    const validName = name.length === 0 || name.length >= 3;

    if (validCode || validName) {
      this.$getAllRolesService.setParams({
        searchCode: code,
        searchName: name,
        page: 1,
      });
    }
  }

  createNewRole() {
    this.dialog.open(CreateNewRoleModalComponent, {
      width: '90%',
      data: {},
    });
  }
}
