import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getInventoryErrorMessage, SupplierDto, SupplierPayTermType, SuppliersService } from '../../data-access';

/** Proveedor creado (para dejarlo seleccionado sin recargar la lista). undefined = cancelado. */
export type CreateSupplierModalResult = SupplierDto | undefined;

@Component({
  selector: 'app-create-supplier-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Nuevo proveedor</h2>
      </ng-template>

      <form [formGroup]="form" (ngSubmit)="handleSubmit()" class="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="supplier-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="supplier-name"
            type="text"
            formControlName="name"
            placeholder="Ej: Distribuidora Central"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="isInvalid('name')" />
          @if (isInvalid('name')) {
          <p class="text-destructive mt-1 text-xs">Ingresa el nombre.</p>
          }
        </div>

        <div>
          <label for="supplier-mobile" class="mb-1 block text-sm font-medium">Teléfono *</label>
          <input
            id="supplier-mobile"
            type="tel"
            inputmode="tel"
            formControlName="mobile"
            placeholder="+56 9 1234 5678"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="isInvalid('mobile')" />
          @if (isInvalid('mobile')) {
          <p class="text-destructive mt-1 text-xs">Ingresa un teléfono.</p>
          }
        </div>

        <div>
          <label for="supplier-email" class="mb-1 block text-sm font-medium">Email</label>
          <input
            id="supplier-email"
            type="email"
            formControlName="email"
            placeholder="Opcional"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="isInvalid('email')" />
          @if (isInvalid('email')) {
          <p class="text-destructive mt-1 text-xs">Revisa el email.</p>
          }
        </div>

        <div>
          <label for="supplier-business" class="mb-1 block text-sm font-medium">Razón social</label>
          <input
            id="supplier-business"
            type="text"
            formControlName="supplierBusinessName"
            placeholder="Opcional"
            class="glass-input w-full rounded-md px-3 py-2" />
        </div>

        <div>
          <label for="supplier-tax" class="mb-1 block text-sm font-medium">RUT</label>
          <input
            id="supplier-tax"
            type="text"
            formControlName="taxNumber"
            placeholder="Opcional. Ej: 76.123.456-7"
            class="glass-input w-full rounded-md px-3 py-2" />
        </div>

        <div class="sm:col-span-2">
          <label for="supplier-term" class="mb-1 block text-sm font-medium">Condiciones de pago</label>
          <div class="flex gap-2">
            <input
              id="supplier-term"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              formControlName="payTermNumber"
              placeholder="Ej: 30"
              class="glass-input w-28 min-w-0 rounded-md px-3 py-2 text-right tabular-nums"
              [class.border-red-500]="isInvalid('payTermNumber')" />
            <select
              formControlName="payTermType"
              aria-label="Unidad de las condiciones de pago"
              class="glass-input min-w-0 flex-1 rounded-md px-3 py-2 sm:flex-none">
              <option value="days">días</option>
              <option value="months">meses</option>
            </select>
          </div>
          @if (isInvalid('payTermNumber')) {
          <p class="text-destructive mt-1 text-xs">Usa un número entero desde 0.</p>
          } @else {
          <p class="text-muted-foreground mt-1 text-xs">0 o vacío = contado. Con plazo, las compras vencen a esa cantidad de días o meses.</p>
          }
        </div>

        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="handleCancel()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" (buttonClick)="handleSubmit()">
            {{ $isSaving() ? 'Guardando…' : 'Crear proveedor' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class CreateSupplierModalComponent {
  readonly #fb = inject(FormBuilder);
  readonly #dialogRef = inject<MatDialogRef<CreateSupplierModalComponent, CreateSupplierModalResult>>(MatDialogRef);
  readonly #suppliers = inject(SuppliersService);
  readonly #toast = inject(ToastService);

  readonly form = this.#fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(191)]],
    mobile: ['', [Validators.required, Validators.maxLength(191)]],
    email: ['', [Validators.email]],
    supplierBusinessName: [''],
    taxNumber: [''],
    // Vacío o 0 = contado.
    payTermNumber: this.#fb.control<number | null>(null, [Validators.min(0), Validators.max(3650), Validators.pattern(/^\d+$/)]),
    payTermType: this.#fb.nonNullable.control<SupplierPayTermType>('days'),
  });

  readonly $isSaving = signal(false);

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payTermNumber = Number(value.payTermNumber ?? 0);
    // Strings vacíos se omiten.
    const dto = {
      name: value.name.trim(),
      mobile: value.mobile.trim(),
      ...(value.email.trim() ? { email: value.email.trim() } : {}),
      ...(value.supplierBusinessName.trim() ? { supplierBusinessName: value.supplierBusinessName.trim() } : {}),
      ...(value.taxNumber.trim() ? { taxNumber: value.taxNumber.trim() } : {}),
      ...(payTermNumber > 0 ? { payTermNumber, payTermType: value.payTermType } : {}),
    };
    this.$isSaving.set(true);
    this.#suppliers.create(dto).subscribe({
      next: ({ id }) =>
        this.#dialogRef.close({
          id,
          type: 'supplier',
          name: dto.name,
          mobile: dto.mobile,
          email: dto.email ?? null,
          supplierBusinessName: dto.supplierBusinessName ?? null,
          taxNumber: dto.taxNumber ?? null,
          payTermNumber: dto.payTermNumber ?? null,
          payTermType: dto.payTermType ?? null,
        }),
      // El modal queda abierto con los datos para reintentar.
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getInventoryErrorMessage(error, 'No se pudo crear el proveedor. Intenta nuevamente.'), 'error');
      },
    });
  }

  handleCancel() {
    this.#dialogRef.close(undefined);
  }
}
