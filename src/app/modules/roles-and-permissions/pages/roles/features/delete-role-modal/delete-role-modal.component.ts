import { Component, effect, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DeleteRoleService, GetAllRolesService, getRoleErrorMessage, RoleDto } from '../../data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

@Component({
  selector: 'app-delete-role-modal',
  imports: [IconComponent, SlotDirective, ButtonComponent, ModalCardComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './delete-role-modal.component.html',
})
export class DeleteRoleModalComponent implements OnDestroy {
  protected readonly dialogRef = inject(MatDialogRef<DeleteRoleModalComponent>);
  protected readonly $deleteRoleService = inject(DeleteRoleService);
  private readonly $toast = inject(ToastService);
  protected readonly $getAllRolesService = inject(GetAllRolesService);

  protected readonly $isLoading = this.$deleteRoleService.$isLoading;

  protected readonly data = inject(MAT_DIALOG_DATA) as RoleDto;

  constructor() {
    effect(() => {
      if (this.$deleteRoleService.$success()) {
        this.$toast.show(`Rol "${this.data.name}" eliminado.`, 'success');
        this.$getAllRolesService.retry();
        this.dialogRef.close();
      }
      const error = this.$deleteRoleService.$error();
      if (error) {
        const message = getRoleErrorMessage(error);
        if (message) this.$toast.show(message, 'error');
      }
    });
  }

  submit() {
    this.$deleteRoleService.delete({ id: this.data.id });
  }

  ngOnDestroy(): void {
    this.$deleteRoleService.reset();
  }
}
