import { Component, EventEmitter, inject, input, Output, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  PaginationTableComponent,
  ProgressBarComponent,
  SlotDirective,
  TableComponent,
} from 'src/ui';
import { BadgeComponent } from 'src/ui/atoms/badge';
import { FiltersTableRolesUserComponent } from '../../ui';
import { MatDialog } from '@angular/material/dialog';
import { UserWithRolesDto } from '../../data-access';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { AssignRoleModalComponent } from '../assign-role-modal';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PERMISSIONS } from 'src/app/core/permissions';

@Component({
  selector: 'app-roles-user-table',
  imports: [
    TableComponent,
    SlotDirective,
    ButtonComponent,
    IconComponent,
    PaginationTableComponent,
    ProgressBarComponent,
    FiltersTableRolesUserComponent,
    BadgeComponent,
    CheckPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './roles-user-table.component.html',
})
export class RolesUserTableComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  readonly $users = input.required<UserWithRolesDto[]>({ alias: 'users' });
  readonly isLoading = input<boolean | undefined>(false, { alias: 'isLoading' });

  @Output() pageChange = new EventEmitter<number>();
  @Output() perPageChange = new EventEmitter<number>();
  @Output() searchFullNameChange = new EventEmitter<string>();
  @Output() retryData = new EventEmitter<void>();

  readonly $pagination = input.required<PaginationMeta>({ alias: 'pagination' });
  headerData = ['Nombre completo', 'Email', 'Roles', 'Acción'];
  readonly perPage = signal(10);

  isOwner(user: UserWithRolesDto): boolean {
    return user.roles.some((role) => role.code === 'OWNER');
  }

  assignRole(user: UserWithRolesDto) {
    this.dialog.open(AssignRoleModalComponent, {
      width: '600px',
      data: { userId: user.userId, userRoles: user.roles },
    });
  }

  onChangePage(page: number) {
    this.pageChange.emit(page);
  }

  onSearchFullNameChange(value: string) {
    this.searchFullNameChange.emit(value);
  }

  onPerPageChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.perPage.set(value);
    this.perPageChange.emit(value);
  }

  retry() {
    this.retryData.emit();
  }
}
