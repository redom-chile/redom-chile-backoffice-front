import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, from, map, mergeMap, of, Subject, Subscription, switchMap } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  formatQuantity,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  ProductionResultDto,
  ProductRecipesDto,
  RecipesService,
  RecipeVariationDto,
  todayIsoDate,
  unitMultiplier,
  UnitsService,
  unitsForProduct,
} from '../../data-access';
import { LoadErrorComponent } from '../../shared';
import { InventoryDisabledComponent, LocationSelectComponent } from '../../ui';
import {
  canProduce,
  estimateProduction,
  getProductionErrorMessage,
  PreparationProduct,
  PreparationsService,
  stockSearchTerm,
} from './data-access';
import { PreparationPickerComponent } from './features';
import { ConsumedItemInfo, IngredientStock, ProductionEstimateComponent, ProductionSummaryComponent } from './ui';

// Saldos de ingredientes que se consultan en paralelo para el consumo estimado.
const STOCK_CONCURRENCY = 4;

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function decimalsOf(value: number): number {
  const [, decimals = ''] = String(value).split('.');
  return decimals.length;
}

/** Cantidad a producir: > 0 y máx. 4 decimales. */
function quantityValidator(control: AbstractControl<number | null>): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return { required: true };
  if (value <= 0) return { positive: true };
  if (decimalsOf(value) > 4) return { precision: true };
  return null;
}

type ResultContext = Readonly<{
  preparationName: string;
  unitName: string | null;
  locationName: string;
  documentDate: string;
  items: ReadonlyMap<number, ConsumedItemInfo>;
}>;

/**
 * Nueva producción de una preparación: consume sus ingredientes en proporción al rinde y suma stock
 * de la preparación al costo consumido. Query params opcionales: variationId, productId, locationId.
 */
@Component({
  selector: 'app-production-new',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    LoadErrorComponent,
    LocationSelectComponent,
    PreparationPickerComponent,
    ProductionEstimateComponent,
    ProductionSummaryComponent,
  ],
  templateUrl: './production-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ProductionNewComponent implements OnInit {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #inventory = inject(InventoryService);
  readonly #recipes = inject(RecipesService);
  readonly #preparations = inject(PreparationsService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly formatQuantity = formatQuantity;
  protected readonly isReady = canProduce;
  protected readonly emptyItems: ReadonlyMap<number, ConsumedItemInfo> = new Map();

  readonly $settingsLoaded = this.#settings.$isLoaded;
  readonly $settingsError = this.#settings.$hasError;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;
  readonly $allowNegativeStock = computed(() => this.#settings.$inventory().allowNegativeStock);
  readonly #disabledByServer = signal(false);
  readonly $isDisabled = computed(
    () => this.#disabledByServer() || (this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled()),
  );

  readonly form = this.#fb.group({
    variationId: this.#fb.control<number | null>(null, [Validators.required]),
    quantity: this.#fb.control<number | null>(null, [quantityValidator]),
    unitId: this.#fb.control<number | null>(null),
    documentDate: [todayIsoDate(), [Validators.required]],
    lotNumber: ['', [Validators.maxLength(100)]],
    expiryDate: [''],
    notes: ['', [Validators.maxLength(1000)]],
  });
  readonly #value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // Preparación elegida y su receta (con los costos del local elegido).
  readonly $product = signal<PreparationProduct | null>(null);
  readonly $isResolvingProduct = signal(false);
  readonly $recipe = signal<ProductRecipesDto | null>(null);
  readonly $recipeLoading = signal(false);
  readonly $recipeError = signal<unknown>(null);
  #recipeRequest: Subscription | null = null;
  #preselectVariationId = positiveId(this.#route.snapshot.queryParamMap.get('variationId'));

  readonly $variations = computed(() => this.$recipe()?.variations ?? []);
  readonly $variation = computed<RecipeVariationDto | null>(
    () => this.$variations().find((variation) => variation.variationId === this.#value().variationId) ?? null,
  );
  readonly $canProduce = computed(() => canProduce(this.$variation()));
  readonly $isPreparation = computed(() => {
    const recipe = this.$recipe();
    return !recipe || recipe.recipeKind === 'production';
  });

  // Unidades: la de la preparación y sus subunidades.
  readonly $allUnits = computed(() => this.#units.$units() ?? []);
  readonly $unitOptions = computed(() => unitsForProduct(this.$allUnits(), this.$product()?.unitId ?? null));
  readonly $productUnitName = computed(() => {
    const unitId = this.$product()?.unitId;
    return this.$allUnits().find((unit) => unit.id === unitId)?.shortName ?? null;
  });
  // Cantidad en la unidad de la preparación (la del rinde).
  readonly $producedBase = computed(() => {
    const { quantity, unitId } = this.#value();
    if (quantity === null || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return null;
    const productUnitId = this.$product()?.unitId ?? null;
    const unit = this.$allUnits().find((option) => option.id === unitId) ?? null;
    const multiplier = unit && unit.id !== productUnitId ? unitMultiplier(unit) : 1;
    return Math.round(Number(quantity) * multiplier * 10000) / 10000;
  });
  readonly $quantityEquivalent = computed(() => {
    const productUnitId = this.$product()?.unitId ?? null;
    const unitId = this.#value().unitId;
    const base = this.$producedBase();
    if (base === null || !unitId || unitId === productUnitId) return null;
    return `= ${formatQuantity(base, this.$productUnitName())}`;
  });
  readonly $estimate = computed(() => {
    const variation = this.$variation();
    const produced = this.$producedBase();
    return variation && produced && canProduce(variation) ? estimateProduction(variation, produced) : null;
  });

  // Saldo de cada ingrediente en el local (opcional: si falla queda "—").
  readonly $stock = signal<IngredientStock>({});
  readonly #stockKey$ = new Subject<Readonly<{ locationId: number; items: ReadonlyArray<{ variationId: number; name: string }> }> | null>();

  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly $result = signal<ProductionResultDto | null>(null);
  readonly $resultContext = signal<ResultContext | null>(null);

  constructor() {
    // Cada vez que cambia la preparación o el local se vuelve a pedir la receta (los costos son del local).
    effect(() => {
      const product = this.$product();
      const locationId = this.locationStore.$locationId();
      untracked(() => this.#loadRecipe(product?.id ?? null, locationId));
    });

    // Variación por defecto: la pedida en la URL o la primera que se puede producir.
    effect(() => {
      const variations = this.$variations();
      untracked(() => {
        if (!variations.length) return;
        const current = this.form.controls.variationId.value;
        if (variations.some((variation) => variation.variationId === current)) return;
        const wanted = variations.find((variation) => variation.variationId === this.#preselectVariationId);
        this.#preselectVariationId = null;
        const fallback = wanted ?? variations.find(canProduce) ?? variations[0];
        this.form.controls.variationId.setValue(fallback.variationId);
      });
    });

    // Saldos para el consumo estimado: solo cuando cambian el local o los ingredientes, no la cantidad.
    this.#stockKey$
      .pipe(
        switchMap((key) => {
          this.$stock.set({});
          if (!key) return of<[number, number | null] | null>(null);
          return from(key.items).pipe(
            mergeMap(
              (item) =>
                this.#inventory.getStock({ locationId: key.locationId, search: stockSearchTerm(item.name), page: 1, perPage: 50 }).pipe(
                  map((page): [number, number | null] => {
                    const row = page.data.find((stock) => stock.variationId === item.variationId);
                    return [item.variationId, row ? Number(row.qtyAvailable) : null];
                  }),
                  catchError(() => of<[number, number | null]>([item.variationId, null])),
                ),
              STOCK_CONCURRENCY,
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((entry) => {
        if (entry) this.$stock.update((stock) => ({ ...stock, [entry[0]]: entry[1] }));
      });

    const stockKey = computed(() => {
      const variation = this.$variation();
      const locationId = this.locationStore.$locationId();
      if (!variation || !locationId || !canProduce(variation)) return null;
      return JSON.stringify([locationId, variation.variationId, variation.items.map((item) => item.ingredientVariationId)]);
    });
    effect(() => {
      const key = stockKey();
      untracked(() => {
        const variation = this.$variation();
        const locationId = this.locationStore.$locationId();
        this.#stockKey$.next(
          key && variation && locationId
            ? {
                locationId,
                items: variation.items.map((item) => ({ variationId: item.ingredientVariationId, name: item.ingredientName })),
              }
            : null,
        );
      });
    });

    this.#destroyRef.onDestroy(() => this.#recipeRequest?.unsubscribe());
  }

  ngOnInit(): void {
    const params = this.#route.snapshot.queryParamMap;
    const locationId = positiveId(params.get('locationId'));
    if (locationId) this.locationStore.select(locationId);
    this.#units.load();

    const productId = positiveId(params.get('productId'));
    const variationId = this.#preselectVariationId;
    if (productId || variationId) {
      this.$isResolvingProduct.set(true);
      const product$ = productId ? this.#preparations.getProduct(productId) : this.#preparations.findByVariation(variationId!);
      product$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
        next: (product) => {
          this.$isResolvingProduct.set(false);
          if (product) this.selectProduct(product, false);
          else this.#toast.show('No se encontró la preparación pedida. Búscala por nombre.', 'warning');
        },
        error: () => {
          this.$isResolvingProduct.set(false);
          this.#toast.show('No se pudo cargar la preparación pedida. Búscala por nombre.', 'warning');
        },
      });
    }
  }

  /** fromUser = false al precargar desde la URL (no cuenta como cambio sin guardar). */
  selectProduct(product: PreparationProduct | null, fromUser = true) {
    if (product?.id === this.$product()?.id) return;
    this.$product.set(product);
    this.$recipe.set(null);
    this.form.patchValue({ variationId: null, unitId: product?.unitId ?? null });
    if (fromUser) this.form.markAsDirty();
  }

  reloadRecipe() {
    this.#loadRecipe(this.$product()?.id ?? null, this.locationStore.$locationId());
  }

  retrySettings() {
    this.#settings.reload();
  }

  quantityError(): string | null {
    const control = this.form.controls.quantity;
    if (!control.errors || !(control.touched || this.$submitted())) return null;
    if (control.errors['positive']) return 'La cantidad debe ser mayor a 0.';
    if (control.errors['precision']) return 'Máximo 4 decimales.';
    return 'Ingresa cuánto vas a producir.';
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const locationId = this.locationStore.$locationId();
    const product = this.$product();
    const variation = this.$variation();
    if (!locationId) {
      this.#toast.show('Elige un local.', 'warning');
      return;
    }
    if (!product || !variation) {
      this.#toast.show('Elige la preparación que vas a producir.', 'warning');
      return;
    }
    if (!canProduce(variation)) {
      this.#toast.show('Esta preparación no tiene receta con ingredientes y rinde.', 'warning');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados.', 'warning');
      return;
    }

    const value = this.form.getRawValue();
    const notes = value.notes?.trim();
    const lotNumber = value.lotNumber?.trim();
    const unitId = value.unitId && value.unitId !== product.unitId ? value.unitId : null;
    const context: ResultContext = {
      preparationName: variation.variationName ? `${product.name} - ${variation.variationName}` : product.name,
      unitName: this.$productUnitName(),
      locationName: this.locationStore.$location()?.name ?? '',
      documentDate: value.documentDate ?? todayIsoDate(),
      items: new Map(variation.items.map((item) => [item.ingredientVariationId, { name: item.ingredientName, unitName: item.unitName }])),
    };

    this.$isSaving.set(true);
    this.#inventory
      .createProduction({
        locationId,
        variationId: variation.variationId,
        quantity: Number(value.quantity),
        ...(unitId ? { unitId } : {}),
        ...(value.documentDate ? { documentDate: value.documentDate } : {}),
        ...(notes ? { notes } : {}),
        ...(lotNumber ? { lotNumber } : {}),
        ...(value.expiryDate ? { expiryDate: value.expiryDate } : {}),
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.$isSaving.set(false);
          this.$resultContext.set(context);
          this.$result.set(result);
          this.form.markAsPristine();
          this.#toast.show('Producción registrada', 'success');
        },
        // 409 sin stock u otro error: toast traducido y el formulario queda intacto.
        error: (error) => {
          this.$isSaving.set(false);
          if (isInventoryDisabledError(error)) {
            this.#disabledByServer.set(true);
            return;
          }
          this.#toast.show(getProductionErrorMessage(error), 'error');
        },
      });
  }

  /** Otra producción: conserva local, preparación y fecha; limpia cantidad, lote y notas. */
  newProduction() {
    this.$result.set(null);
    this.$resultContext.set(null);
    this.$submitted.set(false);
    this.form.patchValue({ quantity: null, lotNumber: '', expiryDate: '', notes: '', unitId: this.$product()?.unitId ?? null });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    // Costos y saldos cambiaron con la producción anterior.
    this.reloadRecipe();
  }

  hasUnsavedChanges(): boolean {
    return !this.$result() && !this.$isSaving() && this.form.dirty;
  }

  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  #loadRecipe(productId: number | null, locationId: number | null) {
    this.#recipeRequest?.unsubscribe();
    this.$recipeError.set(null);
    if (!productId) {
      this.$recipe.set(null);
      this.$recipeLoading.set(false);
      return;
    }
    this.$recipeLoading.set(true);
    this.#recipeRequest = this.#recipes.getByProduct(productId, locationId).subscribe({
      next: (recipe) => {
        this.$recipe.set(recipe);
        this.$recipeLoading.set(false);
      },
      error: (error) => {
        this.$recipeLoading.set(false);
        if (isInventoryDisabledError(error)) {
          this.#disabledByServer.set(true);
          return;
        }
        this.$recipeError.set(error);
      },
    });
  }
}
