import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { GetAllCategoriesService } from 'src/app/modules/products/pages/categories/data-access';
import { suggestSku } from 'src/app/modules/products/pages/product-list/ui/product-form-fields/product-form';
import { getInventoryErrorMessage, UnitsService, unitLabel } from '../../../../data-access';
import { IngredientDto, IngredientsService } from '../../data-access';

export type IngredientModalData = Readonly<{ ingredient?: IngredientDto }>;
export type IngredientModalResult = 'created' | 'updated';

// Variación única para productos sin variaciones reales (convención del backend).
const DEFAULT_VARIATION_NAME = 'DUMMY';

@Component({
  selector: 'app-ingredient-modal',
  imports: [ReactiveFormsModule, NgClass, RouterLink, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './ingredient-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientModalComponent implements OnInit {
  readonly #dialogRef = inject<MatDialogRef<IngredientModalComponent, IngredientModalResult>>(MatDialogRef);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #ingredients = inject(IngredientsService);
  readonly #units = inject(UnitsService);
  readonly #categories = inject(GetAllCategoriesService);

  readonly ingredient = inject<IngredientModalData | null>(MAT_DIALOG_DATA, { optional: true })?.ingredient ?? null;
  readonly isEdit = !!this.ingredient;
  readonly inputClass = 'glass-input w-full rounded-md px-3 py-2';
  readonly unitLabel = unitLabel;

  readonly $isSaving = signal(false);
  readonly $categories = computed(() => this.#categories.$categories() ?? []);
  readonly $unitsLoading = this.#units.$isLoading;
  // La unidad del ingrediente es una unidad base: las subunidades (ej. kg) se usan al comprar o ajustar.
  // (Se mantiene la unidad actual aunque no sea base, para no perderla al editar.)
  readonly $baseUnits = computed(() =>
    (this.#units.$units() ?? []).filter((unit) => !unit.baseUnitId || unit.id === this.ingredient?.unitId),
  );

  readonly form = inject(FormBuilder).group({
    name: [this.ingredient?.name ?? '', [Validators.required, Validators.minLength(2)]],
    sku: [this.ingredient?.sku ?? '', [Validators.required, Validators.maxLength(30)]],
    unitId: [this.ingredient?.unitId ?? (null as number | null), [Validators.required]],
    alertQuantity: [this.ingredient?.alertQuantity || (null as number | null), [Validators.min(0)]],
    categoryId: [this.ingredient?.categoryId ?? (null as number | null)],
  });

  readonly #unitId = toSignal(this.form.controls.unitId.valueChanges, { initialValue: this.form.controls.unitId.value });
  readonly $selectedUnit = computed(() => this.$baseUnits().find((unit) => unit.id === this.#unitId()) ?? null);

  ngOnInit(): void {
    this.#units.load();
    if (!this.#categories.$categories()?.length) this.#categories.getAll();

    // Al crear: mientras el usuario no edite el SKU, se sugiere a partir del nombre (como en productos).
    if (!this.isEdit) {
      const { name, sku } = this.form.controls;
      name.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((value) => {
        if (!sku.dirty) sku.setValue(value?.trim() ? suggestSku(value) : '');
      });
    }
  }

  regenerateSku() {
    const { name, sku } = this.form.controls;
    sku.setValue(suggestSku(name.value ?? ''));
    sku.markAsDirty();
  }

  isInvalid(control: 'name' | 'sku' | 'unitId' | 'alertQuantity' | 'categoryId'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show(this.form.controls.unitId.invalid ? 'Elige la unidad del ingrediente' : 'Completa los campos obligatorios', 'warning');
      return;
    }
    const value = this.form.getRawValue();
    const name = value.name!.trim();
    const sku = value.sku!.trim().toUpperCase();
    const unitId = value.unitId!;
    const alertQuantity = value.alertQuantity ?? undefined;

    const request$ = this.ingredient
      ? this.#ingredients.update(this.ingredient.id, {
          name,
          sku,
          ...(unitId !== this.ingredient.unitId ? { unitId } : {}),
          alertQuantity: alertQuantity ?? 0,
          ...((value.categoryId ?? null) !== (this.ingredient.categoryId ?? null) ? { categoryId: value.categoryId ?? null } : {}),
        })
      : this.#ingredients.create({
          name,
          sku,
          type: 'ingredient',
          unitId,
          ...(alertQuantity ? { alertQuantity } : {}),
          ...(value.categoryId ? { categoryId: value.categoryId } : {}),
          variations: [{ name: DEFAULT_VARIATION_NAME }],
        });

    this.$isSaving.set(true);
    request$.subscribe({
      next: () => this.#dialogRef.close(this.isEdit ? 'updated' : 'created'),
      // El modal queda abierto con lo ingresado.
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getInventoryErrorMessage(error, 'No se pudo guardar el ingrediente.'), 'error');
      },
    });
  }

  handleCancel() {
    this.#dialogRef.close();
  }
}
