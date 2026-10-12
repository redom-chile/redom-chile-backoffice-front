import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getModifierSetErrorMessage, ModifierSetDto, ModifierSetsService } from '../../data-access';
import { ModifierSetModalResult } from '../modifier-set-modal-result';

export type ModifierSetModalData = Readonly<{ set?: ModifierSetDto }>;

type OptionForm = FormGroup<{
  // null: opción nueva (aún no guardada).
  id: FormControl<number | null>;
  name: FormControl<string>;
  price: FormControl<number | null>;
}>;

const normalize = (name: string) => name.trim().toLocaleLowerCase('es');

@Component({
  selector: 'app-modifier-set-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './modifier-set-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModifierSetModalComponent {
  readonly #dialogRef = inject<MatDialogRef<ModifierSetModalComponent, ModifierSetModalResult>>(MatDialogRef);
  readonly #toast = inject(ToastService);
  readonly #service = inject(ModifierSetsService);
  readonly #fb = inject(NonNullableFormBuilder);

  readonly set = inject<ModifierSetModalData>(MAT_DIALOG_DATA)?.set ?? null;
  readonly isEdit = !!this.set;
  readonly inputClass = 'glass-input w-full rounded-md px-3 py-2';

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);

  readonly form = this.#fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    options: this.#fb.array<OptionForm>([]),
  });

  constructor() {
    if (this.set) {
      this.form.controls.name.setValue(this.set.name);
      // Mismo orden en que el backend aplica las ediciones (id ASC).
      [...this.set.variations]
        .sort((a, b) => a.id - b.id)
        .forEach((option) => this.options.push(this.#optionGroup(option.id, option.name, option.price)));
    } else {
      this.addOption();
    }
  }

  get options(): FormArray<OptionForm> {
    return this.form.controls.options;
  }

  addOption() {
    this.options.push(this.#optionGroup(null, '', 0));
  }

  // Solo se pueden quitar opciones nuevas: el backend no permite eliminar una opción guardada.
  removeOption(index: number) {
    if (this.options.at(index).controls.id.value !== null) return;
    this.options.removeAt(index);
  }

  isInvalid(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || this.$submitted());
  }

  /** Nombres repetidos (sin distinguir mayúsculas ni espacios). */
  duplicatedNames(): Set<string> {
    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const option of this.options.controls) {
      const name = normalize(option.controls.name.value);
      if (!name) continue;
      if (seen.has(name)) duplicated.add(name);
      seen.add(name);
    }
    return duplicated;
  }

  isDuplicated(option: OptionForm, duplicated: Set<string>): boolean {
    return duplicated.has(normalize(option.controls.name.value));
  }

  handleSubmit() {
    this.$submitted.set(true);
    this.form.markAllAsTouched();
    if (!this.options.length) {
      this.#toast.show('Agrega al menos una opción', 'warning');
      return;
    }
    if (this.form.invalid) {
      this.#toast.show('Completa el nombre del set y el nombre y precio de cada opción', 'warning');
      return;
    }
    if (this.duplicatedNames().size) {
      this.#toast.show('Hay opciones con el mismo nombre', 'warning');
      return;
    }

    const name = this.form.controls.name.value.trim();
    const rows = this.options.getRawValue().map((option) => ({
      id: option.id,
      name: option.name.trim(),
      price: Number(option.price),
    }));
    const existing = rows.filter((row) => row.id !== null).sort((a, b) => a.id! - b.id!);
    const added = rows.filter((row) => row.id === null);

    const request$ = this.set
      ? this.#service.update({
          id: this.set.id,
          name,
          // Se envían todas las opciones existentes, en orden de id, para no pisar una con otra.
          modifierNameEdit: existing.map((row) => row.name),
          modifierPriceEdit: existing.map((row) => row.price),
          ...(added.length
            ? { modifierName: added.map((row) => row.name), modifierPrice: added.map((row) => row.price) }
            : {}),
        })
      : this.#service.create({
          name,
          modifierName: added.map((row) => row.name),
          modifierPrice: added.map((row) => row.price),
        });

    this.$isSaving.set(true);
    request$.subscribe({
      next: () => this.#dialogRef.close(this.isEdit ? 'updated' : 'created'),
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getModifierSetErrorMessage(error, 'No se pudo guardar el set.'), 'error');
      },
    });
  }

  handleCancel() {
    this.#dialogRef.close();
  }

  #optionGroup(id: number | null, name: string, price: number): OptionForm {
    return new FormGroup({
      id: new FormControl<number | null>(id),
      name: new FormControl(name, { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
      // Pesos chilenos: entero y sin negativos.
      price: new FormControl<number | null>(price, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]),
    });
  }
}
