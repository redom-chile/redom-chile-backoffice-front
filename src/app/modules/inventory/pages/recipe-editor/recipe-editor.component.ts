import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, Subscription } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  getInventoryErrorMessage,
  InventoryLocationStore,
  isInventoryDisabledError,
  ProductRecipesDto,
  RecipesService,
} from '../../data-access';
import { LoadErrorComponent } from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import { RecipeCardComponent } from './features';

/** Editor de recetas de un plato (una por variación) o de un set de modificadores (una por opción). */
@Component({
  selector: 'app-recipe-editor',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    LoadErrorComponent,
    RecipeCardComponent,
  ],
  templateUrl: './recipe-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class RecipeEditorComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #recipes = inject(RecipesService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly locations = inject(InventoryLocationStore);

  readonly $settingsLoaded = this.#settings.$isLoaded;
  readonly $settingsError = this.#settings.$hasError;
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;

  readonly $productId = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('productId')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('productId')),
  });

  readonly $data = signal<ProductRecipesDto | null>(null);
  readonly $isLoading = signal(false);
  readonly $isRefreshing = signal(false);
  readonly $error = signal<unknown>(null);
  // null = costo promedio del negocio.
  readonly $locationId = signal<number | null>(null);
  readonly #dirty = signal<ReadonlySet<number>>(new Set());
  #request: Subscription | null = null;

  readonly $isModifier = computed(() => this.$data()?.productType === 'modifier');
  readonly $hasUnsaved = computed(() => this.#dirty().size > 0);
  readonly $backLink = computed(() => ({ tab: this.$isModifier() ? 'opciones' : null }));
  // Costo por unidad base de todos los ingredientes que ya aparecen en alguna receta del producto.
  readonly $unitCosts = computed(() => {
    const costs = new Map<number, number>();
    this.$data()?.variations.forEach((variation) =>
      variation.items.forEach((item) => {
        if (item.unitCost !== undefined) costs.set(item.ingredientVariationId, item.unitCost);
      }),
    );
    return costs as ReadonlyMap<number, number>;
  });

  constructor() {
    effect(() => {
      const productId = this.$productId();
      if (!this.$ingredientsEnabled() || !Number.isInteger(productId) || productId <= 0) return;
      untracked(() => this.load());
    });
    this.#destroyRef.onDestroy(() => this.#request?.unsubscribe());
  }

  load() {
    this.$data.set(null);
    this.$error.set(null);
    this.$isLoading.set(true);
    this.#dirty.set(new Set());
    this.#fetch((data) => this.$data.set(data));
  }

  retrySettings() {
    this.#settings.reload();
  }

  onLocationChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.$locationId.set(value > 0 ? value : null);
    // Solo cambian los costos: las tarjetas conservan lo que se está editando.
    this.$isRefreshing.set(true);
    this.#fetch((data) => this.$data.set(data));
  }

  /** Después de guardar se vuelve a pedir para refrescar los costos de esa variación. */
  onSaved(variationId: number) {
    this.$isRefreshing.set(true);
    this.#fetch((fresh) => {
      const current = this.$data();
      const updated = fresh.variations.find((variation) => variation.variationId === variationId);
      if (!current || !updated) {
        this.$data.set(fresh);
        return;
      }
      this.$data.set({
        ...current,
        variations: current.variations.map((variation) => (variation.variationId === variationId ? updated : variation)),
      });
    }, true);
  }

  onDirtyChange(variationId: number, dirty: boolean) {
    this.#dirty.update((current) => {
      if (current.has(variationId) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(variationId);
      else next.delete(variationId);
      return next;
    });
  }

  hasUnsavedChanges(): boolean {
    return this.$hasUnsaved();
  }

  onBeforeUnload(event: BeforeUnloadEvent) {
    if (this.$hasUnsaved()) event.preventDefault();
  }

  #fetch(apply: (data: ProductRecipesDto) => void, quiet = false) {
    this.#request?.unsubscribe();
    this.#request = this.#recipes.getByProduct(this.$productId(), this.$locationId()).subscribe({
      next: (data) => {
        apply(data);
        this.$isLoading.set(false);
        this.$isRefreshing.set(false);
      },
      error: (error) => {
        this.$isLoading.set(false);
        this.$isRefreshing.set(false);
        if (isInventoryDisabledError(error)) this.#settings.reload();
        if (this.$data() && !isInventoryDisabledError(error)) {
          // Ya hay datos en pantalla: solo se avisa.
          if (!quiet) this.#toast.show(getInventoryErrorMessage(error, 'No se pudieron actualizar los costos.'), 'error');
          return;
        }
        this.$error.set(error);
      },
    });
  }
}
