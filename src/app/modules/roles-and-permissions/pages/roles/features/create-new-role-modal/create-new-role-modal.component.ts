import { Component, effect, inject, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  ButtonComponent,
  CaseTransformDirective,
  IconComponent,
  ModalCardComponent,
  SlotDirective,
  ToastService,
} from 'src/ui';
import { CreateRoleService, GetAllRolesService, getRoleErrorMessage } from '../../data-access';

@Component({
  selector: 'app-create-new-role-modal',
  imports: [
    FormsModule,
    IconComponent,
    ReactiveFormsModule,
    ButtonComponent,
    SlotDirective,
    ModalCardComponent,
    CaseTransformDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './create-new-role-modal.component.html',
})
export class CreateNewRoleModalComponent implements OnDestroy {
  protected readonly dialogRef = inject(MatDialogRef);
  protected readonly $createRoleService = inject(CreateRoleService);
  private readonly $toast = inject(ToastService);
  protected readonly $getAllRolesService = inject(GetAllRolesService);

  protected readonly $isLoading = this.$createRoleService.$isLoading;
  /** Roles de los que se pueden copiar los permisos (undefined mientras cargan). */
  protected readonly $roleOptions = toSignal(this.$getAllRolesService.options());

  private fb = inject(FormBuilder);

  form = this.fb.group({
    name: ['', [Validators.required]],
    code: ['', [Validators.required, Validators.maxLength(50)]],
    copyFromRoleId: [null as number | null],
  });

  constructor() {
    effect(() => {
      if (this.$createRoleService.$success()) {
        this.$toast.show(`Rol "${this.form.value.name}" creado.`, 'success');
        this.$getAllRolesService.retry();
        this.dialogRef.close();
      }
      const error = this.$createRoleService.$error();
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
    const { code, name, copyFromRoleId } = this.form.getRawValue();
    this.$createRoleService.create({
      code: (code ?? '').trim().toUpperCase(),
      name: (name ?? '').trim(),
      ...(copyFromRoleId ? { copyFromRoleId: Number(copyFromRoleId) } : {}),
    });
  }

  ngOnDestroy(): void {
    this.$createRoleService.reset();
  }
}
