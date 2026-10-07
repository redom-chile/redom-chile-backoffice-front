import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EmptyStateComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { InventoryLocationStore, InventoryService, isInventoryDisabledError, StockFiltersDto, StockKind } from '../../data-access';
import { InventoryDisabledComponent, LocationSelectComponent } from '../../ui';
import { LoadErrorComponent, readOption, readPage, resultError, resultValue, toRemoteResult } from '../../shared';
import { LowStockAlertComponent, StockTableComponent } from './features';
import { StockFilters, StockFiltersComponent } from './ui';

const PER_PAGE = 25;
const KINDS: readonly StockKind[] = ['ingredient', 'product'];

type StockQuery = StockFilters & Readonly<{ page: number }>;

function toQuery(params: ParamMap): StockQuery {
  return {
    page: readPage(params),
    search: (params.get('search') ?? '').trim(),
    kind: readOption<StockKind>(params, 'kind', KINDS),
    lowStock: params.get('low') === 'true',
  };
}

/**
 * Pantalla principal del inventario: stock del local elegido con su costo promedio y valor.
 * Filtros en la URL (search, kind, low, page); el local vive en el InventoryLocationStore.
 */
@Component({
  selector: 'app-stock',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    EmptyStateComponent,
    InventoryDisabledComponent,
    LocationSelectComponent,
    LoadErrorComponent,
    LowStockAlertComponent,
    StockFiltersComponent,
    StockTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock.component.html',
})
export class StockComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;
  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  readonly stock = rxResource({
    params: (): StockFiltersDto | undefined => {
      const locationId = this.locationStore.$locationId();
      if (this.#isDisabledBySettings() || locationId === null) return undefined;
      const { page, search, kind, lowStock } = this.$query();
      return {
        locationId,
        page,
        perPage: PER_PAGE,
        search: search || undefined,
        kind: kind ?? undefined,
        lowStock: lowStock || undefined,
      };
    },
    stream: ({ params }) => this.#inventory.getStock(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.stock.value()));
  readonly $error = computed(() => resultError(this.stock.value()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));
  readonly $isLoading = computed(() => this.stock.isLoading() || (this.locationStore.$isLoading() && this.locationStore.$locations().length === 0));
  readonly $hasNoLocations = computed(
    () => !this.locationStore.$isLoading() && !this.locationStore.$hasError() && this.locationStore.$locations().length === 0,
  );

  readonly $hasFilters = computed(() => {
    const { search, kind, lowStock } = this.$query();
    return search !== '' || kind !== null || lowStock;
  });
  // Sin nada con stock en el local (y sin filtros): estado vacío con la explicación de cómo empezar.
  readonly $isEmpty = computed(() => !this.$isLoading() && !this.$hasFilters() && this.$page()?.pagination.totalItems === 0);

  handleFiltersChange(changes: Partial<StockFilters>) {
    const params: Record<string, string | null> = { page: null };
    if ('search' in changes) params['search'] = changes.search || null;
    if ('kind' in changes) params['kind'] = changes.kind ?? null;
    if ('lowStock' in changes) params['low'] = changes.lowStock ? 'true' : null;
    this.#navigate(params);
  }

  handleClearFilters() {
    this.#navigate({ page: null, search: null, kind: null, low: null });
  }

  handleLowStockAlert() {
    this.handleFiltersChange({ lowStock: !this.$query().lowStock });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
