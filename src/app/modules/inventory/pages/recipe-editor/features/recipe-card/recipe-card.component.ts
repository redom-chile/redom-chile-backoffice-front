import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  formatUnitCost,
  getInventoryErrorMessage,
  RecipesService,
  RecipeVariationDto,
  StockableItem,
  UnitDto,
  UnitsService,
  unitsForProduct,
} from '../../../../data-access';
import {
  baseQuantity,
  createRecipeRow,
  MAX_RECIPE_ITEMS,
  quantityError,
  RecipeRowForm,
  recipeSignature,
  rowFromRecipeItem,
  savedItemsSignature,
  toRecipeItems,
  wasteError,
} from '../../data-access';
import { RecipeIngredientSearchComponent } from '../ingredient-search';

/**
 * Receta de una variación del plato (o de una opción del set): tabla editable de ingredientes,
 * costos de lo guardado y guardado independiente por tarjeta.
 */
@Component({
  selector: 'app-recipe-card',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, RecipeIngredientSearchComponent],
  templateUrl: './recipe-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCardComponent {
  readonly #recipes = inject(RecipesService);
  readonly #unitsService = inject(UnitsService);
  readonly #toast = inject(ToastService);

  readonly productId = input.required<number>();
  readonly productName = input.required<string>();
  // Set de modificadores: cada tarjeta es una opción y puede quitar ingredientes.
  readonly isModifier = input(false);
  readonly variation = input.required<RecipeVariationDto>();
  // Otras variaciones del plato, para "Copiar receta de…".
  readonly siblings = input<readonly RecipeVariationDto[]>([]);
  // Costo por unidad base de cada ingrediente conocido (variationId → costo).
  readonly unitCosts = input<ReadonlyMap<number, number>>(new Map());

  readonly saved = output<number>();
  readonly dirtyChange = output<boolean>();

  protected readonly rows = new FormArray<RecipeRowForm>([]);
  protected readonly formatMoney = formatMoney;
  protected readonly formatUnitCost = formatUnitCost;
  protected readonly formatQuantity = formatQuantity;
  protected readonly quantityError = quantityError;
  protected readonly wasteError = wasteError;

  readonly #version = signal(0);
  readonly #baseline = signal('[]');
  #savedKey: string | null = null;
  protected readonly $isSaving = signal(false);
  protected readonly $showErrors = signal(false);

  protected readonly $units = computed(() => this.#unitsService.$units() ?? []);
  protected readonly $title = computed(() => this.variation().variationName ?? this.productName());
  protected readonly $isDirty = computed(() => {
    this.#version();
    return recipeSignature(this.rows) !== this.#baseline();
  });
  protected readonly $addedIds = computed(() => {
    this.#version();
    return this.rows.controls.map((row) => row.controls.item.value.variationId);
  });
  protected readonly $copySources = computed(() => this.siblings().filter((sibling) => sibling.variationId !== this.variation().variationId));
  // Con cambios sin guardar el costo se estima en el front (el % de costo lo calcula el backend con el IVA).
  protected readonly $estimatedCost = computed(() => {
    this.#version();
    this.unitCosts();
    this.$units();
    return this.rows.controls.reduce((sum, row) => sum + (this.rowCost(row) ?? 0), 0);
  });

  constructor() {
    this.#unitsService.load();
    const destroyRef = inject(DestroyRef);
    this.rows.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.#version.update((v) => v + 1));

    // Se rehace el formulario solo si cambió lo guardado (no cuando solo cambian los costos).
    effect(() => {
      const variation = this.variation();
      const key = savedItemsSignature(variation.items);
      if (key === this.#savedKey) return;
      this.#savedKey = key;
      untracked(() => this.#resetFrom(variation));
    });

    effect(() => this.dirtyChange.emit(this.$isDirty()));
  }

  // ---------- Filas ----------

  protected addIngredient(item: StockableItem) {
    if (this.rows.controls.some((row) => row.controls.item.value.variationId === item.variationId)) {
      this.#toast.show(`"${item.label}" ya está en la receta. Ajusta su cantidad.`, 'warning');
      return;
    }
    if (this.rows.length >= MAX_RECIPE_ITEMS) {
      this.#toast.show(`Una receta puede tener hasta ${MAX_RECIPE_ITEMS} ingredientes.`, 'warning');
      return;
    }
    this.rows.push(createRecipeRow(item));
  }

  protected remove(index: number) {
    this.rows.removeAt(index);
  }

  protected copyFrom(event: Event) {
    const select = event.target as HTMLSelectElement;
    const source = this.$copySources().find((sibling) => sibling.variationId === Number(select.value));
    select.value = '';
    if (!source) return;
    this.rows.clear();
    source.items.forEach((item) => this.rows.push(rowFromRecipeItem(item)));
    this.$showErrors.set(false);
    const name = source.variationName ?? this.productName();
    this.#toast.show(`Receta copiada de "${name}". Revisa y guarda los cambios.`, 'success');
  }

  protected discard() {
    this.#resetFrom(this.variation());
  }

  // ---------- Cálculos por fila ----------

  protected unitOptions(row: RecipeRowForm): UnitDto[] {
    return unitsForProduct(this.$units(), row.controls.item.value.unitId);
  }

  protected baseUnitName(row: RecipeRowForm): string | null {
    const unitId = row.controls.item.value.unitId;
    return unitId ? (this.$units().find((unit) => unit.id === unitId)?.shortName ?? null) : null;
  }

  /** "= 150 g" cuando se carga en una subunidad. */
  protected baseEquivalent(row: RecipeRowForm): string | null {
    const unit = this.#unit(row);
    if (!unit?.baseUnitId) return null;
    const base = baseQuantity(row, unit);
    if (base === null || !row.controls.quantity.value) return null;
    return `= ${formatQuantity(Math.abs(base), this.baseUnitName(row))}`;
  }

  /** Lo que descuenta (o devuelve) por unidad vendida, con la merma: cantidad × (1 + merma/100). */
  protected consumption(row: RecipeRowForm): string | null {
    const base = baseQuantity(row, this.#unit(row));
    if (base === null || !row.controls.quantity.value) return null;
    const total = Math.abs(base) * (1 + this.#waste(row) / 100);
    const text = formatQuantity(Math.round(total * 10000) / 10000, this.baseUnitName(row));
    return base < 0 ? `Devuelve ${text}` : `Descuenta ${text}`;
  }

  protected rowUnitCost(row: RecipeRowForm): number | null {
    return this.unitCosts().get(row.controls.item.value.variationId) ?? null;
  }

  protected rowCost(row: RecipeRowForm): number | null {
    const unitCost = this.rowUnitCost(row);
    const base = baseQuantity(row, this.#unit(row));
    if (unitCost === null || base === null) return null;
    return base * (1 + this.#waste(row) / 100) * unitCost;
  }

  protected isTouched(row: RecipeRowForm): boolean {
    return row.touched || this.$showErrors();
  }

  // ---------- Guardar ----------

  protected save() {
    if (this.$isSaving()) return;
    if (this.rows.invalid) {
      this.$showErrors.set(true);
      this.rows.markAllAsTouched();
      this.#toast.show('Revisa las cantidades y mermas marcadas.', 'warning');
      return;
    }
    const variationIds = this.rows.controls.map((row) => row.controls.item.value.variationId);
    if (new Set(variationIds).size !== variationIds.length) {
      this.#toast.show('Hay un ingrediente repetido: suma sus cantidades en una sola fila.', 'warning');
      return;
    }

    this.$isSaving.set(true);
    const signature = recipeSignature(this.rows);
    this.#recipes.update(this.variation().variationId, { items: toRecipeItems(this.rows) }).subscribe({
      next: (response) => {
        this.$isSaving.set(false);
        this.$showErrors.set(false);
        // Lo guardado pasa a ser la referencia; la recarga con costos no rehace el formulario.
        this.#savedKey = savedItemsSignature(response.items);
        this.#baseline.set(signature);
        this.#toast.show(
          response.items.length ? `Receta de "${this.$title()}" guardada` : `Receta de "${this.$title()}" eliminada`,
          'success',
        );
        this.saved.emit(this.variation().variationId);
      },
      error: (error) => {
        this.$isSaving.set(false);
        this.#toast.show(getInventoryErrorMessage(error, 'No se pudo guardar la receta.'), 'error');
      },
    });
  }

  // ---------- Privados ----------

  #resetFrom(variation: RecipeVariationDto) {
    this.rows.clear({ emitEvent: false });
    variation.items.forEach((item) => this.rows.push(rowFromRecipeItem(item), { emitEvent: false }));
    this.rows.markAsUntouched();
    this.$showErrors.set(false);
    this.#baseline.set(recipeSignature(this.rows));
    this.#version.update((v) => v + 1);
  }

  #unit(row: RecipeRowForm): UnitDto | null {
    const { item, unitId } = row.getRawValue();
    const id = unitId ?? item.unitId;
    return id ? (this.$units().find((unit) => unit.id === id) ?? null) : null;
  }

  #waste(row: RecipeRowForm): number {
    const waste = Number(row.controls.wastePercent.value ?? 0);
    return Number.isFinite(waste) ? waste : 0;
  }
}
