import { NgClass } from '@angular/common';
import { Component, EventEmitter, inject, input, Output, ChangeDetectionStrategy } from '@angular/core';
import {
  ButtonComponent,
  IconComponent,
  PaginationTableComponent,
  ProgressBarComponent,
  SlotDirective,
  TableComponent,
} from 'src/ui';
import { FiltersTableUserComponent } from '../../ui';
import { MatDialog } from '@angular/material/dialog';
import { UserDto } from '../../data-access';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { CreateUserModalComponent } from '../create-user-modal';
import { UpdateUserModalComponent } from '../update-user-modal';
import { DeleteUserModalComponent } from '../delete-user-modal';
import { SetServicePinModalComponent } from '../set-service-pin-modal';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { PlanLockedBadgeComponent } from 'src/app/shared/components/plan-limit';

@Component({
  selector: 'app-users-table',
  imports: [
    NgClass,
    TableComponent,
    SlotDirective,
    ButtonComponent,
    IconComponent,
    PaginationTableComponent,
    ProgressBarComponent,
    FiltersTableUserComponent,
    CheckPermissionDirective,
    PlanLockedBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './users-table.component.html',
})
export class UsersTableComponent {
  private readonly dialog = inject(MatDialog);
  readonly #entitlements = inject(EntitlementsService);
  readonly $users = input.required<UserDto[]>({ alias: 'users' });
  readonly isLoading = input<boolean | undefined>(false, { alias: 'isLoading' });
  // id de sucursal -> nombre, para mostrar la sucursal de cada usuario.
  readonly $branchNames = input<Record<number, string>>({}, { alias: 'branchNames' });

  @Output() pageChange = new EventEmitter<number>();
  @Output() perPageChange = new EventEmitter<number>();
  @Output() searchNameChange = new EventEmitter<string>();
  @Output() retryData = new EventEmitter<void>();

  readonly $pagination = input.required<PaginationMeta>({ alias: 'pagination' });
  headerData = ['Nombre', 'Email', 'Sucursal', 'PIN POS', 'Estado'];

  createUser() {
    this.dialog.open(CreateUserModalComponent, {
      width: '90%',
      data: {},
    });
  }

  updateUser(item: UserDto) {
    this.dialog.open(UpdateUserModalComponent, {
      width: '90%',
      data: item,
    });
  }

  // Al guardar el PIN se recarga la lista para reflejar hasPin.
  setServicePin(item: UserDto) {
    this.dialog
      .open(SetServicePinModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: item,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.retry();
      });
  }

  getBranchName(user: UserDto): string | null {
    if (user.branchId === null) return null;
    return this.$branchNames()[user.branchId] ?? `Sucursal #${user.branchId}`;
  }

  deleteUser(item: UserDto) {
    this.dialog.open(DeleteUserModalComponent, {
      width: '90%',
      data: item,
    });
  }

  isLocked(user: UserDto): boolean {
    return this.#entitlements.isLocked('users', user.code);
  }

  getFullName(user: UserDto): string {
    return `${user.name} ${user.fatherLastName} ${user.motherLastName}`.trim();
  }

  onChangePage(page: number) {
    this.pageChange.emit(page);
  }

  onSearchNameChange(value: string) {
    this.searchNameChange.emit(value);
  }

  onPerPageChange(event: Event) {
    this.perPageChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  retry() {
    this.retryData.emit();
  }
}
