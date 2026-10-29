import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService, PlanUpsellService } from 'src/app/core/services/entitlements';
import { PlanLockBadgeComponent } from 'src/app/modules/products/shared';
import { ImageSelection } from 'src/app/core/services/file-upload';
import { RouterLink } from '@angular/router';
import { IconComponent, ImagePickerComponent } from 'src/ui';
import { STOCK_MODE_OPTIONS, UnitDto, unitLabel } from 'src/app/modules/inventory/data-access';
import { CategoryDto } from '../../../categories/data-access';
import { CHEF_NOTE_MAX } from '../../data-access';
import { ProductDescriptionAiComponent } from '../menu-ai-assist';
import {
  createVarietyForm,
  duplicatedVarietyNames,
  isVarietyNamedAsProduct,
  MIN_VARIETIES,
  normalizeVarietyName,
  ProductForm,
  setVarietiesMode,
  suggestSku,
  VARIETY_NAME_MAX,
  VarietyForm,
} from './product-form';

@Component({
  selector: 'app-product-form-fields',
  imports: [ReactiveFormsModule, NgClass, RouterLink, IconComponent, ImagePickerComponent, PlanLockBadgeComponent, ProductDescriptionAiComponent],
  templateUrl: './product-form-fields.component.html',
})
export class ProductFormFieldsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly businessSettings = inject(BusinessSettingsService);

  // Según "Datos fiscales": el precio incluye IVA (lo habitual) o es neto y el IVA se suma al vender.
  readonly $pricesExcludeVat = this.businessSettings.$pricesExcludeVat;
  readonly $vatRate = this.businessSettings.$vatRate;

  // Nota del chef: requiere menu_design; sin la función se muestra bloqueada con la mejora de plan.
  readonly #entitlements = inject(EntitlementsService);
  readonly #upsell = inject(PlanUpsellService);
  readonly $chefNoteEnabled = computed(() => this.#entitlements.hasFeature('menu_design'));
  readonly chefNoteMax = CHEF_NOTE_MAX;
  readonly $chefNoteLength = signal(0);

  readonly form = input.required<ProductForm>();
  readonly categories = input<CategoryDto[]>([]);
  // Solo al crear: al editar, el SKU existente no debe cambiar al renombrar.
  readonly autoSuggestSku = input(true);
  // Producto guardado (al editar): habilita "Sugerir con IA" en la descripción.
  readonly productId = input<number | null>(null);
  readonly currentImageUrl = input<string | null | undefined>(null);
  readonly uploading = input(false);
  readonly uploadProgress = input(0);
  readonly imageChange = output<ImageSelection>();
  // Control de stock: solo con el inventario activo; "Por receta" requiere ingredientes y recetas.
  readonly inventoryEnabled = input(false);
  readonly ingredientsEnabled = input(false);
  readonly units = input<readonly UnitDto[]>([]);
  // Variedades guardadas sin receta (solo al editar un plato "Por receta"); null = no se sabe.
  readonly missingRecipeIds = input<ReadonlySet<number> | null>(null);
  readonly configureRecipe = output<void>();

  readonly stockModeOptions = STOCK_MODE_OPTIONS;
  readonly unitLabel = unitLabel;
  // La unidad del producto debe ser una unidad base (las subunidades se usan al comprar/ajustar).
  readonly $baseUnits = computed(() => this.units().filter((unit) => !unit.baseUnitId));
  readonly $stockMode = signal<string>('none');
  readonly typeOptions = [
    { value: false, label: 'Producto', hint: 'Un plato, bebida o artículo que se vende solo.' },
    { value: true, label: 'Pack / combo', hint: 'Varios productos juntos a un precio (ej. lomo + bebida a elección).' },
  ] as const;
  readonly $isPack = signal(false);

  // Variedades: reemplazan al precio único.
  readonly varietyNameMax = VARIETY_NAME_MAX;
  readonly $hasVarieties = signal(false);
  // Se quitó alguna variedad ya guardada (se oculta, no se elimina).
  readonly $removedSaved = signal(false);

  readonly $selectedCategoryId = signal<number | null>(null);
  readonly $subcategories = computed(() => {
    const parent = this.categories().find((category) => category.id === this.$selectedCategoryId());
    return parent?.subcategories ?? [];
  });

  readonly inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

  ngOnInit(): void {
    const { name, sku, categoryId, subCategoryId, stockMode, isPack, hasVarieties, chefNote } = this.form().controls;
    this.$chefNoteLength.set(chefNote.value?.length ?? 0);
    chefNote.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.$chefNoteLength.set(value?.length ?? 0));
    this.$hasVarieties.set(!!hasVarieties.value);
    this.$isPack.set(!!isPack.value);
    isPack.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.$isPack.set(!!value));
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

  showChefNotePlans() {
    this.#upsell.open({ features: ['menu_design'] });
  }

  /** La sugerencia elegida queda en el formulario; se guarda con "Guardar". */
  setDescription(text: string) {
    const control = this.form().controls.productDescription;
    control.setValue(text);
    control.markAsDirty();
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

  enableVarieties() {
    const { varieties, price, singleVariationId, hasVarieties } = this.form().controls;
    // El precio único pasa a ser la primera variedad (mismo id: conserva ventas, stock y receta).
    if (!varieties.length) {
      varieties.push(createVarietyForm(singleVariationId.value, '', price.value));
      while (varieties.length < MIN_VARIETIES) varieties.push(createVarietyForm());
    }
    hasVarieties.setValue(true);
    setVarietiesMode(this.form(), true);
    this.$hasVarieties.set(true);
  }

  disableVarieties() {
    const { varieties, price, hasVarieties } = this.form().controls;
    if (price.value === null && varieties.length) price.setValue(varieties.at(0).controls.price.value);
    hasVarieties.setValue(false);
    setVarietiesMode(this.form(), false);
    this.$hasVarieties.set(false);
  }

  addVariety() {
    this.form().controls.varieties.push(createVarietyForm());
  }

  removeVariety(index: number) {
    const varieties = this.form().controls.varieties;
    if (varieties.at(index).controls.id.value !== null) this.$removedSaved.set(true);
    varieties.removeAt(index);
  }

  isVarietyInvalid(variety: VarietyForm, field: 'name' | 'price'): boolean {
    const control = variety.controls[field];
    if (control.invalid && control.touched) return true;
    if (field !== 'name') return false;
    return duplicatedVarietyNames(this.form()).has(normalizeVarietyName(variety.controls.name.value)) || this.isNamedAsProduct(variety);
  }

  isNamedAsProduct(variety: VarietyForm): boolean {
    return isVarietyNamedAsProduct(this.form(), variety.controls.name.value);
  }

  hasNoRecipe(variety: VarietyForm): boolean {
    const id = variety.controls.id.value;
    return id !== null && !!this.missingRecipeIds()?.has(id);
  }

  /** Nombres de las variedades guardadas que aún no tienen receta. */
  missingRecipeNames(): string[] {
    return this.form()
      .controls.varieties.controls.filter((variety) => this.hasNoRecipe(variety))
      .map((variety) => variety.controls.name.value?.trim() || 'Sin nombre');
  }

  isInvalid(control: keyof ProductForm['controls']): boolean {
    const field = this.form().controls[control];
    return field.invalid && field.touched;
  }
}
