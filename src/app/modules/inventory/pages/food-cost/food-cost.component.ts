import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { CategoryDto, GetAllCategoriesService } from 'src/app/modules/products/pages/categories/data-access';
import { EmptyStateComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import {
  FOOD_COST_LEVEL_CLASSES,
  FOOD_COST_THRESHOLDS,
  FoodCostFiltersDto,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
} from '../../data-access';
import { LoadErrorComponent, readId, resultError, resultValue, toRemoteResult } from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import {
  FOOD_COST_SORT_OPTIONS,
  FoodCostSort,
  FoodCostSortKey,
  hasWarning,
  parseSort,
  sortFoodCost,
  sortValue,
  summarizeFoodCost,
} from './data-access';
import { FoodCostSummaryComponent, FoodCostTableComponent } from './ui';

const SEARCH_MAX = 100;

type FoodCostQuery = Readonly<{
  // null = promedio del negocio.
  locationId: number | null;
  search: string;
  categoryId: number | null;
  onlyWarnings: boolean;
  sort: FoodCostSort;
}>;

function toQuery(params: ParamMap): FoodCostQuery {
  return {
    locationId: readId(params, 'locationId'),
    search: (params.get('search') ?? '').trim().slice(0, SEARCH_MAX),
    categoryId: readId(params, 'categoryId'),
    onlyWarnings: params.get('avisos') === 'true',
    sort: parseSort(params.get('orden')),
  };
}

type CategoryOption = Readonly<{ id: number; label: string }>;

function flattenCategories(categories: readonly CategoryDto[], depth = 0, seen = new Set<number>()): CategoryOption[] {
  return categories.flatMap((category) => {
    if (seen.has(category.id)) return [];
    seen.add(category.id);
    return [
      { id: category.id, label: `${'— '.repeat(depth)}${category.name}` },
      ...flattenCategories(category.subcategories ?? [], depth + 1, seen),
    ];
  });
}

/**
 * Food cost: cuánto del precio sin IVA se va en costo, por plato (receta) y producto con stock propio.
 * Filtros en la URL; el local aquí es independiente del elegido en el resto del inventario.
 */
@Component({
  selector: 'app-food-cost',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    EmptyStateComponent,
    InventoryDisabledComponent,
    LoadErrorComponent,
    FoodCostSummaryComponent,
    FoodCostTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './food-cost.component.html',
})
export class FoodCostComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #categories = inject(GetAllCategoriesService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly thresholds = FOOD_COST_THRESHOLDS;
  protected readonly levelClasses = FOOD_COST_LEVEL_CLASSES;
  protected readonly sortOptions = FOOD_COST_SORT_OPTIONS;
  protected readonly sortValue = sortValue;
  protected readonly searchMax = SEARCH_MAX;

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly search = new FormControl(this.$query().search, { nonNullable: true });
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  readonly foodCost = rxResource({
    params: (): FoodCostFiltersDto | undefined => {
      if (this.#isDisabledBySettings()) return undefined;
      const { locationId, search, categoryId } = this.$query();
      return {
        locationId: locationId ?? undefined,
        search: search || undefined,
        categoryId: categoryId ?? undefined,
      };
    },
    stream: ({ params }) => this.#inventory.getFoodCost(params).pipe(toRemoteResult()),
  });

  readonly $items = computed(() => resultValue(this.foodCost.value()));
  readonly $error = computed(() => resultError(this.foodCost.value()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));
  readonly $isLoading = computed(() => this.foodCost.isLoading());

  readonly $summary = computed(() => {
    const items = this.$items();
    return items ? summarizeFoodCost(items) : null;
  });
  readonly $rows = computed(() => {
    const { onlyWarnings, sort } = this.$query();
    const items = this.$items() ?? [];
    return sortFoodCost(onlyWarnings ? items.filter(hasWarning) : items, sort);
  });

  readonly $categoryOptions = computed(() => flattenCategories(this.#categories.$categories() ?? []));

  readonly $hasServerFilters = computed(() => {
    const { search, categoryId } = this.$query();
    return search !== '' || categoryId !== null;
  });
  readonly $hasFilters = computed(() => this.$hasServerFilters() || this.$query().onlyWarnings);
  // Sin nada que analizar (y sin filtros): estado vacío con cómo empezar.
  readonly $isEmpty = computed(() => !this.$isLoading() && !this.$hasServerFilters() && this.$items()?.length === 0);

  constructor() {
    if (!(this.#categories.$categories() ?? []).length) this.#categories.getAll();

    this.search.valueChanges
      .pipe(
        debounceTime(300),
        map((value) => value.trim().slice(0, SEARCH_MAX)),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((search) => {
        if (search !== this.$query().search) this.#navigate({ search: search || null });
      });
  }

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ locationId: value > 0 ? String(value) : null });
  }

  onCategory(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ categoryId: value > 0 ? String(value) : null });
  }

  onSortSelect(event: Event) {
    this.#setSort(parseSort((event.target as HTMLSelectElement).value));
  }

  /** Clic en el encabezado: mismo campo invierte; otro campo arranca en su orden natural. */
  onSortHeader(key: FoodCostSortKey) {
    const current = this.$query().sort;
    if (current.key === key) {
      this.#setSort({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    this.#setSort({ key, dir: key === 'percent' ? 'desc' : 'asc' });
  }

  toggleWarnings() {
    this.#navigate({ avisos: this.$query().onlyWarnings ? null : 'true' });
  }

  clearFilters() {
    this.search.setValue('', { emitEvent: false });
    this.#navigate({ search: null, categoryId: null, avisos: null });
  }

  #setSort(sort: FoodCostSort) {
    const value = sortValue(sort);
    this.#navigate({ orden: value === 'percent-desc' ? null : value });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
