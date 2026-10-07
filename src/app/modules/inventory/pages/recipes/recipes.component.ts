import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, map, mergeMap, of, Subject } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ModifierSetDto, ModifierSetsService } from 'src/app/modules/products/pages/modifiers/data-access';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { RecipesService } from '../../data-access';
import { LoadErrorComponent } from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import { RecipeProduct, RecipeProductsService, RecipeStatus, toRecipeStatus } from './data-access';
import { RecipeStatusBadgeComponent } from './ui';

export type RecipesTab = 'platos' | 'opciones';

const PAGE_SIZE = 20;
// Recetas que se consultan en paralelo para calcular el estado de las filas visibles.
const STATUS_CONCURRENCY = 4;

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Inventario → Recetas: platos "Por receta" y sets de modificadores, con el estado de su receta. */
@Component({
  selector: 'app-recipes',
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
    RecipeStatusBadgeComponent,
  ],
  templateUrl: './recipes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipesComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);
  readonly #settings = inject(BusinessSettingsService);
  readonly #products = inject(RecipeProductsService);
  readonly #recipes = inject(RecipesService);
  readonly #modifierSets = inject(ModifierSetsService);

  readonly $settingsLoaded = this.#settings.$isLoaded;
  readonly $settingsError = this.#settings.$hasError;
  readonly $inventoryEnabled = this.#settings.$inventoryEnabled;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;

  readonly $tab = toSignal(
    this.#route.queryParamMap.pipe(map((params): RecipesTab => (params.get('tab') === 'opciones' ? 'opciones' : 'platos'))),
    { initialValue: 'platos' as RecipesTab },
  );
  readonly search = new FormControl('', { nonNullable: true });
  readonly $term = toSignal(this.search.valueChanges.pipe(debounceTime(250), map((value) => normalize(value.trim()))), {
    initialValue: '',
  });

  // Platos
  readonly $dishes = signal<RecipeProduct[] | null>(null);
  readonly $dishesError = signal<unknown>(null);
  readonly $visibleCount = signal(PAGE_SIZE);
  readonly $filteredDishes = computed(() => {
    const term = this.$term();
    const dishes = this.$dishes() ?? [];
    return term ? dishes.filter((dish) => normalize(dish.name).includes(term) || normalize(dish.sku).includes(term)) : dishes;
  });
  readonly $visibleDishes = computed(() => this.$filteredDishes().slice(0, this.$visibleCount()));

  // Sets de modificadores
  readonly $sets = this.#modifierSets.$sets;
  readonly $setsLoading = computed(() => this.#modifierSets.$isLoading() && this.#modifierSets.$sets() === null);
  readonly $setsError = computed(() => (this.#modifierSets.$sets() === null ? this.#modifierSets.$error() : null));
  readonly $filteredSets = computed(() => {
    const term = this.$term();
    const sets = this.$sets() ?? [];
    if (!term) return sets;
    return sets.filter(
      (set) => normalize(set.name).includes(term) || set.variations.some((option) => normalize(option.name).includes(term)),
    );
  });

  // Estado de receta por productId (el id del set también es un productId).
  readonly $statuses = signal<Readonly<Record<number, RecipeStatus>>>({});
  readonly #statusQueue$ = new Subject<number>();

  constructor() {
    this.#statusQueue$
      .pipe(
        mergeMap(
          (productId) =>
            this.#recipes.getByProduct(productId).pipe(
              map((data) => [productId, toRecipeStatus(data)] as const),
              catchError(() => of([productId, { kind: 'error' } as RecipeStatus] as const)),
            ),
          STATUS_CONCURRENCY,
        ),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(([productId, status]) => this.$statuses.update((current) => ({ ...current, [productId]: status })));

    // Carga las listas cuando las recetas están activas.
    effect(() => {
      if (!this.$ingredientsEnabled()) return;
      untracked(() => {
        this.loadDishes();
        this.#modifierSets.load();
      });
    });

    // Solo se revisan las filas visibles de la pestaña actual.
    effect(() => {
      const ids = this.$tab() === 'platos' ? this.$visibleDishes().map((dish) => dish.id) : this.$filteredSets().map((set) => set.id);
      untracked(() => this.#queueStatuses(ids));
    });

    this.search.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.$visibleCount.set(PAGE_SIZE));
  }

  loadDishes() {
    this.$dishes.set(null);
    this.$dishesError.set(null);
    this.#products
      .listRecipeProducts()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (dishes) => this.$dishes.set(dishes),
        error: (error) => this.$dishesError.set(error),
      });
  }

  reloadSets() {
    this.#modifierSets.load();
  }

  retrySettings() {
    this.#settings.reload();
  }

  setTab(tab: RecipesTab) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { tab: tab === 'platos' ? null : tab }, queryParamsHandling: 'merge' });
  }

  showMore() {
    this.$visibleCount.update((count) => count + PAGE_SIZE);
  }

  optionNames(set: ModifierSetDto): string {
    return set.variations.map((option) => option.name).join(', ') || 'Sin opciones';
  }

  variationsLabel(dish: RecipeProduct): string {
    const count = dish.variations.length;
    return count > 1 ? `${count} variaciones` : 'Sin variaciones';
  }

  #queueStatuses(ids: number[]) {
    const current = this.$statuses();
    const pending = ids.filter((id) => !current[id] || current[id].kind === 'error');
    if (!pending.length) return;
    this.$statuses.update((statuses) => {
      const next = { ...statuses };
      pending.forEach((id) => (next[id] = { kind: 'loading' }));
      return next;
    });
    pending.forEach((id) => this.#statusQueue$.next(id));
  }
}
