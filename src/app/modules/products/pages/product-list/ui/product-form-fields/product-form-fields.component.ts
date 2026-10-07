import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ImageSelection } from 'src/app/core/services/file-upload';
import { RouterLink } from '@angular/router';
import { IconComponent, ImagePickerComponent } from 'src/ui';
import { STOCK_MODE_OPTIONS, UnitDto, unitLabel } from 'src/app/modules/inventory/data-access';
import { CategoryDto } from '../../../categories/data-access';
import { ProductForm, suggestSku } from './product-form';

@Component({
  selector: 'app-product-form-fields',
  imports: [ReactiveFormsModule, NgClass, RouterLink, IconComponent, ImagePickerComponent],
  templateUrl: './product-form-fields.component.html',
})
export class ProductFormFieldsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly businessSettings = inject(BusinessSettingsService);

  // Según "Datos fiscales": el precio incluye IVA (lo habitual) o es neto y el IVA se suma al vender.
  readonly $pricesExcludeVat = this.businessSettings.$pricesExcludeVat;
  readonly $vatRate = this.businessSettings.$vatRate;

  readonly form = input.required<ProductForm>();
  readonly categories = input<CategoryDto[]>([]);
  // Solo al crear: al editar, el SKU existente no debe cambiar al renombrar.
  readonly autoSuggestSku = input(true);
  readonly currentImageUrl = input<string | null | undefined>(null);
  readonly uploading = input(false);
  readonly uploadProgress = input(0);
  readonly imageChange = output<ImageSelection>();
  // Control de stock: solo con el inventario activo; "Por receta" requiere ingredientes y recetas.
  readonly inventoryEnabled = input(false);
  readonly ingredientsEnabled = input(false);
  readonly units = input<readonly UnitDto[]>([]);

  readonly stockModeOptions = STOCK_MODE_OPTIONS;
  readonly unitLabel = unitLabel;
  // La unidad del producto debe ser una unidad base (las subunidades se usan al comprar/ajustar).
  readonly $baseUnits = computed(() => this.units().filter((unit) => !unit.baseUnitId));
  readonly $stockMode = signal<string>('none');

  readonly $selectedCategoryId = signal<number | null>(null);
  readonly $subcategories = computed(() => {
    const parent = this.categories().find((category) => category.id === this.$selectedCategoryId());
    return parent?.subcategories ?? [];
  });

  readonly inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  ngOnInit(): void {
    const { name, sku, categoryId, subCategoryId, stockMode } = this.form().controls;
    this.$selectedCategoryId.set(categoryId.value);
    this.$stockMode.set(stockMode.value ?? 'none');
    stockMode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.$stockMode.set(value ?? 'none'));

    // Mientras el usuario no edite el SKU, se sugiere a partir del nombre.
    name.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (this.autoSuggestSku() && !sku.dirty) sku.setValue(value?.trim() ? suggestSku(value) : '');
    });

    categoryId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.$selectedCategoryId.set(value);
      subCategoryId.setValue(null);
    });
  }

  regenerateSku() {
    const { name, sku } = this.form().controls;
    sku.setValue(suggestSku(name.value ?? ''));
    sku.markAsDirty();
  }

  /** "Por receta" se puede mantener si ya estaba, pero no elegir sin ingredientes activos. */
  isStockModeDisabled(value: string): boolean {
    return value === 'recipe' && !this.ingredientsEnabled() && this.$stockMode() !== 'recipe';
  }

  isInvalid(control: keyof ProductForm['controls']): boolean {
    const field = this.form().controls[control];
    return field.invalid && field.touched;
  }
}
