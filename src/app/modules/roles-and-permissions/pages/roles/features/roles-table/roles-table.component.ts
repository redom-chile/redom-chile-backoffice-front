import { Component, EventEmitter, inject, input, Output, ChangeDetectionStrategy } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  PaginationTableComponent,
  ProgressBarComponent,
  SlotDirective,
  TableComponent,
} from 'src/ui';
import { FiltersTableRoleComponent } from '../../ui';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { GetAllRolesDto } from '../../data-access';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { CreateNewRoleModalComponent } from '../create-new-role-modal';
import { UpdateRoleModalComponent } from '../update-role-modal';
import { DeleteRoleModalComponent } from '../delete-role-modal';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-roles-table',
  imports: [
    TableComponent,
    SlotDirective,
    ButtonComponent,
    IconComponent,
    PaginationTableComponent,
    ProgressBarComponent,
    FiltersTableRoleComponent,
    CheckPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './roles-table.component.html',
})
export class RolesTableComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  readonly $getAllRolesDetail = input.required<GetAllRolesDto[]>({
    alias: 'getAllRolesDetail',
  });

  searchCode = input<string>('', { alias: 'searchCode' });
  searchName = input<string>('', { alias: 'searchName' });
  isLoading = input<boolean | undefined>(false, { alias: 'isLoading' });

  @Output() pageChange = new EventEmitter<number>();
  @Output() perPageChange = new EventEmitter<number>();
  @Output() filtersChanged = new EventEmitter<{ code: string; name: string }>();
  @Output() retryData = new EventEmitter<void>();

  readonly $pagination = input.required<PaginationMeta>({
    alias: 'pagination',
  });
  headerData = ['Id', 'Código', 'Nombre', 'Acción'];

  viewDetailRole() {
    this.dialog.open(CreateNewRoleModalComponent, {
      width: '90%',
      data: {},
    });
  }

  openPermissions(item: GetAllRolesDto) {
    this.router.navigate(['/roles-and-permissions/roles-permissions'], { queryParams: { roleId: item.id } });
  }

  updateModule(item: any) {
    this.dialog.open(UpdateRoleModalComponent, {
      width: '90%',
      data: item,
    });
  }
  deleteModule(item: any) {
    this.dialog.open(DeleteRoleModalComponent, {
      width: '90%',
      data: item,
    });
  }

  onChangePage(page: number) {
    this.pageChange.emit(page);
  }

  onSearchCodeChange(value: string) {
    this.filtersChanged.emit({ code: value, name: this.searchName() });
  }

  onSearchNameChange(value: string) {
    this.filtersChanged.emit({ code: this.searchCode(), name: value });
  }
  onPerPageChange(event: Event) {
    this.perPageChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  retry() {
    this.retryData.emit();
  }
}
