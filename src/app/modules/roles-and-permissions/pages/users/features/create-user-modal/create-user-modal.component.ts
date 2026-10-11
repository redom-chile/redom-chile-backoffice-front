import { Component, computed, effect, inject, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CreateUserService, GetAllUsersService, getCreateUserErrorMessage } from '../../data-access';
import { rutValidator } from 'src/app/shared/validators';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { GetAllRolesService } from '../../../roles/data-access';

@Component({
  selector: 'app-create-user-modal',
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
  templateUrl: './create-user-modal.component.html',
})
export class CreateUserModalComponent implements OnDestroy {
  protected readonly dialogRef = inject(MatDialogRef);
  protected readonly $createUserService = inject(CreateUserService);
  private readonly $toast = inject(ToastService);
  protected readonly $getAllUsersService = inject(GetAllUsersService);
  protected readonly $allRolesService = inject(GetAllRolesService);

  protected readonly $isLoading = this.$createUserService.$isLoading;
  protected readonly allRoles = this.$allRolesService.$roles;
  // Solo roles de personal del negocio: SUPERADMIN, OWNER y los de Redom (globales) no se pueden asignar.
  protected readonly $staffRoles = computed(() =>
    (this.allRoles()?.data ?? []).filter((role) => !role.isGlobal && !['SUPERADMIN', 'OWNER'].includes(role.code)),
  );
  protected readonly $loadingRoles = this.$allRolesService.$isLoading;
  protected readonly $locations = inject(GetAllBusinessLocationsService).$locations;

  private fb = inject(FormBuilder);

  form = this.fb.group({
    rut: ['', [rutValidator]],
    name: ['', [Validators.required]],
    fatherLastName: ['', [Validators.required]],
    motherLastName: [''],
    email: ['', [Validators.required, Validators.email]],
    roleIds: [[] as number[]],
    branchId: [null as number | null],
  });

  constructor() {
    this.$createUserService.reset();
    this.$allRolesService.setParams({ page: 1, perPage: 50, searchCode: '', searchName: '' });

    effect(() => {
      if (this.$createUserService.$success()) {
        this.$toast.show(`Usuario '${this.form.get('name')?.value}' creado con éxito`, 'success');
        this.$getAllUsersService.retry();
        this.dialogRef.close();
      }
      const error = this.$createUserService.$error();
      if (error) {
        this.$toast.show(getCreateUserErrorMessage(error), 'error');
      }
    });
  }

  get selectedRoleIds(): number[] {
    return this.form.get('roleIds')?.value ?? [];
  }

  removeRole(roleId: number) {
    this.form.patchValue({ roleIds: this.selectedRoleIds.filter((id) => id !== roleId) });
  }

  submitForm() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rut = this.form.get('rut')!.value ?? '';
    const name = this.form.get('name')!.value ?? '';
    const fatherLastName = this.form.get('fatherLastName')!.value ?? '';
    const motherLastName = this.form.get('motherLastName')!.value ?? '';
    const email = this.form.get('email')!.value ?? '';
    const branchId = this.form.get('branchId')!.value;

    this.$createUserService.create({
      rut,
      name,
      fatherLastName,
      motherLastName,
      email,
      roleIds: this.selectedRoleIds.length > 0 ? this.selectedRoleIds : undefined,
      branchId: branchId ?? undefined,
    });
  }

  ngOnDestroy(): void {
    this.$createUserService.reset();
  }
}
