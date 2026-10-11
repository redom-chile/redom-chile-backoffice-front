import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ButtonComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { GetAllModulesService } from './data-access';
import { ModulesTableComponent } from './features/modules-table/modules-table.component';
import { CreateNewModelModalComponent } from './features/create-new-model-modal/create-new-model-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-modules',
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, ModulesTableComponent, CheckPermissionDirective],
  templateUrl: './modules.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './modules.component.css',
})
export class ModulesComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  protected readonly $getAllModulesService = inject(GetAllModulesService);

  page = 1;
  currentSearchCode = '';
  currentSearchName = '';

  constructor() {
    this.changeData();
  }

  changeData() {
    this.$getAllModulesService.retry();
  }

  retry() {
    this.$getAllModulesService.retry();
  }

  createNewModule() {
    this.dialog.open(CreateNewModelModalComponent, {
      width: '90%',
      data: {},
    });
  }

  onPageChange(page: number) {
    this.page = page;
    this.$getAllModulesService.setParams({ page });
    this.$getAllModulesService.retry();
  }

  onFiltersChange(filters: { code: string; name: string }) {
    const { code, name } = filters;

    this.currentSearchCode = code;
    this.currentSearchName = name;

    const validCode = code.length === 0 || code.length >= 3;
    const validName = name.length === 0 || name.length >= 3;

    if (validCode || validName) {
      this.$getAllModulesService.setParams({
        searchCode: code,
        searchName: name,
        page: 1,
      });
      this.$getAllModulesService.retry();
    }
  }
}
