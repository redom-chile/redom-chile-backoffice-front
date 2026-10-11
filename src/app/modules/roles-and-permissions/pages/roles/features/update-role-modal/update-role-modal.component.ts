import { Component, effect, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GetAllRolesDto, GetAllRolesService, getRoleErrorMessage, UpdateRoleService } from '../../data-access';
import { ButtonComponent, CaseTransformDirective, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-update-role-modal',
  imports: [IconComponent, ModalCardComponent, ButtonComponent, FormsModule, ReactiveFormsModule, SlotDirective, CaseTransformDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './update-role-modal.component.html',
})
export class UpdateRoleModalComponent implements OnDestroy {
  protected readonly dialogRef = inject(MatDialogRef<UpdateRoleModalComponent>);
  protected readonly $updateRoleService = inject(UpdateRoleService);
  private readonly $toast = inject(ToastService);
  protected readonly $getAllRolesService = inject(GetAllRolesService);

  protected readonly $isLoading = this.$updateRoleService.$isLoading;
  protected readonly data = inject(MAT_DIALOG_DATA) as GetAllRolesDto;

  private fb = inject(FormBuilder);

  form = this.fb.group({
    code: [this.data.code, [Validators.required, Validators.maxLength(50)]],
    name: [this.data.name, [Validators.required]],
  });

  constructor() {
    effect(() => {
      if (this.$updateRoleService.$success()) {
        this.$toast.show(`Rol "${this.form.value.name}" actualizado.`, 'success');
        this.$getAllRolesService.retry();
        this.dialogRef.close();
      }
      const error = this.$updateRoleService.$error();
      if (error) {
        const message = getRoleErrorMessage(error);
        if (message) this.$toast.show(message, 'error');
      }
    });
  }

  submitForm() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { code, name } = this.form.getRawValue();
    this.$updateRoleService.update({ id: this.data.id, code: (code ?? '').trim().toUpperCase(), name: (name ?? '').trim() });
  }

  ngOnDestroy(): void {
    this.$updateRoleService.reset();
  }
}
