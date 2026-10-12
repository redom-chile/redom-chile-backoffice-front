import { Component, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { GetAllRolesService, getRoleErrorMessage } from '../../../roles/data-access';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { AssignRoleToUserService, UserRoleItemDto, GetAllUsersWithRolesService } from '../../data-access';

@Component({
  selector: 'app-assign-role-modal',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatFormFieldModule,
    ButtonComponent,
    IconComponent,
    ModalCardComponent,
    SlotDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './assign-role-modal.component.html',
})
export class AssignRoleModalComponent {
  protected readonly dialogRef = inject(MatDialogRef);
  protected readonly $allRolesService = inject(GetAllRolesService);
  private readonly assignService = inject(AssignRoleToUserService);
  private readonly $toast = inject(ToastService);
  private readonly $usersService = inject(GetAllUsersWithRolesService);
  readonly #whoami = inject(WhoamiService);

  protected readonly data: { userId: string; userRoles: UserRoleItemDto[] } = inject(MAT_DIALOG_DATA);

  // Solo los roles que se pueden asignar: el dueño y los de Redom (globales) no.
  readonly #roleOptions = toSignal(this.$allRolesService.options());
  protected readonly allRoles = computed(() => this.#roleOptions()?.filter((role) => !role.isGlobal && role.code !== 'OWNER'));
  protected readonly $loadingRoles = computed(() => this.#roleOptions() === undefined);
  protected readonly $saving = this.assignService.$isLoading;

  rolesControl = new FormControl<number[]>(this.data.userRoles.map((r) => r.id));

  constructor() {
    this.assignService.reset();

    effect(() => {
      if (this.assignService.$success()) {
        this.$toast.show('Roles guardados.', 'success');
        this.$usersService.retry();
        // Si se cambió los roles a sí mismo, sus permisos cambiaron.
        if (this.data.userId === this.#whoami.$whoami()?.user.code) this.#whoami.refetch();
        this.dialogRef.close();
      }
      const error = this.assignService.$error();
      if (error) {
        const message = getRoleErrorMessage(error, 'No se pudieron guardar los roles. Intenta nuevamente.');
        if (message) this.$toast.show(message, 'error');
      }
    });
  }

  get selectedRoleIds(): number[] {
    return this.rolesControl.value ?? [];
  }

  removeRole(roleId: number) {
    this.rolesControl.setValue(this.selectedRoleIds.filter((id) => id !== roleId));
  }

  save() {
    this.assignService.execute(this.data.userId, this.selectedRoleIds);
  }
}
