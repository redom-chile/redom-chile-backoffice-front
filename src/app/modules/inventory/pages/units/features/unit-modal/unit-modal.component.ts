import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CreateUnitDto, getInventoryErrorMessage, UnitDto, UnitsService } from '../../../../data-access';

export type UnitModalData = Readonly<{ unit?: UnitDto; units: readonly UnitDto[] }>;
export type UnitModalResult = 'created' | 'updated';

@Component({
  selector: 'app-unit-modal',
  imports: [ReactiveFormsModule, NgClass, ButtonComponent, ModalCardComponent, SlotDirective],
  templateUrl: './unit-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitModalComponent {
  readonly #dialogRef = inject<MatDialogRef<UnitModalComponent, UnitModalResult>>(MatDialogRef);
  readonly #toast = inject(ToastService);
  readonly #units = inject(UnitsService);
  readonly #data = inject<UnitModalData>(MAT_DIALOG_DATA);

  readonly unit = this.#data.unit ?? null;
  readonly isEdit = !!this.unit;
  readonly inputClass = 'glass-input w-full rounded-md px-3 py-2';
  // Una unidad que ya tiene subunidades no puede pasar a ser subunidad (solo se permite un nivel).
  readonly hasSubunits = !!this.unit && this.#data.units.some((unit) => unit.baseUnitId === this.unit!.id);
  // Solo unidades base (y nunca ella misma) pueden ser la unidad de referencia.
  readonly baseUnits = this.#data.units.filter((unit) => !unit.baseUnitId && unit.id !== this.unit?.id);

  readonly $isSaving = signal(false);

  readonly form = inject(FormBuilder).group({
    actualName: [this.unit?.actualName ?? '', [Validators.required, Validators.maxLength(50)]],
    shortName: [this.unit?.shortName ?? '', [Validators.required, Validators.maxLength(10)]],
    allowDecimal: [this.unit?.allowDecimal ?? false],
    baseUnitId: [{ value: this.unit?.baseUnitId ?? (null as number | null), disabled: this.hasSubunits }],
    baseUnitMultiplier: [this.unit?.baseUnitMultiplier ? Number(this.unit.baseUnitMultiplier) : (null as number | null)],
  });

  readonly #baseUnitId = toSignal(this.form.controls.baseUnitId.valueChanges, { initialValue: this.form.controls.baseUnitId.value });
  readonly #actualName = toSignal(this.form.controls.actualName.valueChanges, { initialValue: this.form.controls.actualName.value });
  readonly $baseUnit = computed(() => this.baseUnits.find((unit) => unit.id === this.#baseUnitId()) ?? null);
  readonly $name = computed(() => this.#actualName()?.trim() || 'esta unidad');

  isInvalid(control: 'actualName' | 'shortName' | 'baseUnitMultiplier'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  /** El multiplicador solo aplica (y es obligatorio y > 0) si es subunidad. */
  #multiplierError(): boolean {
    if (!this.$baseUnit()) return false;
    const value = Number(this.form.controls.baseUnitMultiplier.value);
    return !Number.isFinite(value) || value <= 0;
  }

  readonly $multiplierTouched = signal(false);

  showMultiplierError(): boolean {
    return this.$multiplierTouched() && this.#multiplierError();
  }

  handleSubmit() {
    this.$multiplierTouched.set(true);
    if (this.form.invalid || this.#multiplierError()) {
      this.form.markAllAsTouched();
      this.#toast.show(
        this.#multiplierError() ? 'Indica a cuánto equivale en la unidad base (mayor a 0)' : 'Completa nombre y abreviatura',
        'warning',
      );
      return;
    }
    const value = this.form.getRawValue();
    const baseUnit = this.$baseUnit();
    const dto: CreateUnitDto = {
      actualName: value.actualName!.trim(),
      shortName: value.shortName!.trim(),
      allowDecimal: !!value.allowDecimal,
      baseUnitId: baseUnit ? baseUnit.id : null,
      // El backend recibe el multiplicador como texto decimal (ej. "1000").
      baseUnitMultiplier: baseUnit ? String(Number(value.baseUnitMultiplier)) : null,
    };

    this.$isSaving.set(true);
    const request$ = this.unit ? this.#units.update(this.unit.id, dto) : this.#units.create(dto);
    request$.subscribe({
      next: () => this.#dialogRef.close(this.isEdit ? 'updated' : 'created'),
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getInventoryErrorMessage(error, 'No se pudo guardar la unidad.'), 'error');
      },
    });
  }

  handleCancel() {
    this.#dialogRef.close();
  }
}
