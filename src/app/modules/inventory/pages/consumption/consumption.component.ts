import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { ConsumptionFiltersDto, InventoryLocationStore, InventoryService, isInventoryDisabledError, StockableItem } from '../../data-access';
import { InventoryDisabledComponent } from '../../ui';
import { formatDocumentDate, readDate, readId, readOption, resultError, resultValue, toRemoteResult } from '../../shared';
import {
  CONSUMPTION_RANGES,
  ConsumptionRange,
  ConsumptionSort,
  ConsumptionSortKey,
  DEFAULT_SORT,
  getConsumptionErrorMessage,
  RANGE_OPTIONS,
  rangeDates,
  toggleSort,
} from './data-access';
import { ConsumptionProductFilterComponent, ConsumptionTableComponent } from './features';
import { ConsumptionHelpComponent, ConsumptionSummaryComponent } from './ui';

type ConsumptionQuery = Readonly<{
  locationId: number | null;
  range: ConsumptionRange;
  from: string | null;
  to: string | null;
  productId: number | null;
}>;

function toQuery(params: ParamMap): ConsumptionQuery {
  return {
    locationId: readId(params, 'locationId'),
    range: readOption<ConsumptionRange>(params, 'range', CONSUMPTION_RANGES) ?? 'month',
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    productId: readId(params, 'productId'),
  };
}

/**
 * Consumo teórico vs real de un local en un período: qué debieron consumir las ventas según las recetas,
 * cuánto se perdió en mermas y faltantes de conteo, y la variación valorizada.
 * Filtros en la URL (locationId, range, from, to, productId); sin locationId usa el local del InventoryLocationStore.
 */
@Component({
  selector: 'app-consumption',
  imports: [
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    HeaderDashboardComponent,
    IconComponent,
    InventoryDisabledComponent,
    ConsumptionHelpComponent,
    ConsumptionProductFilterComponent,
    ConsumptionSummaryComponent,
    ConsumptionTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consumption.component.html',
})
export class ConsumptionComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly rangeOptions = RANGE_OPTIONS;
  readonly formatDocumentDate = formatDocumentDate;
  readonly $ingredientsEnabled = this.#settings.$ingredientsEnabled;

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $sort = signal<ConsumptionSort>(DEFAULT_SORT);
  // Nombre del ítem elegido en el buscador (mientras llega el reporte).
  readonly #picked = signal<Readonly<{ productId: number; label: string }> | null>(null);
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  /** Local de la URL o, si no viene, el elegido en el inventario. */
  readonly $locationId = computed(() => this.$query().locationId ?? this.locationStore.$locationId());

  readonly report = rxResource({
    params: (): ConsumptionFiltersDto | undefined => {
      const locationId = this.$locationId();
      if (this.#isDisabledBySettings() || locationId === null) return undefined;
      const { range, from, to, productId } = this.$query();
      return { locationId, ...rangeDates(range, from, to), productId: productId ?? undefined };
    },
    stream: ({ params }) => this.#inventory.getConsumption(params).pipe(toRemoteResult()),
  });

  readonly $report = computed(() => resultValue(this.report.value()));
  readonly $error = computed(() => resultError(this.report.value()));
  readonly $errorMessage = computed(() => getConsumptionErrorMessage(this.$error()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));
  readonly $isLoading = computed(() => this.report.isLoading() || (this.locationStore.$isLoading() && this.locationStore.$locations().length === 0));
  readonly $hasNoLocations = computed(
    () => !this.locationStore.$isLoading() && !this.locationStore.$hasError() && this.locationStore.$locations().length === 0,
  );

  readonly $items = computed(() => this.$report()?.items ?? []);
  readonly $isEmpty = computed(() => !this.$isLoading() && this.$report() !== null && this.$items().length === 0);
  // Sin diferencias de conteo en ningún ítem: probablemente no se contó en el período (un conteo exacto tampoco deja diferencia).
  readonly $hasNoCount = computed(() => this.$items().length > 0 && this.$items().every((item) => !item.countDifference));

  readonly $productLabel = computed(() => {
    const productId = this.$query().productId;
    if (!productId) return null;
    const picked = this.#picked();
    if (picked?.productId === productId) return picked.label;
    return this.$items().find((item) => item.productId === productId)?.itemName ?? `Producto #${productId}`;
  });

  readonly $hasFilters = computed(() => {
    const { range, productId } = this.$query();
    return range !== 'month' || productId !== null;
  });

  onLocation(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    if (!(id > 0)) return;
    this.locationStore.select(id);
    this.#navigate({ locationId: String(id) });
  }

  onRange(range: ConsumptionRange) {
    if (range === 'custom') {
      // Parte desde el período que se está viendo.
      const report = this.$report();
      this.#navigate({ range, from: this.$query().from ?? report?.dateFrom ?? null, to: this.$query().to ?? report?.dateTo ?? null });
    } else {
      this.#navigate({ range: range === 'month' ? null : range, from: null, to: null });
    }
  }

  onDate(field: 'from' | 'to', event: Event) {
    this.#navigate({ range: 'custom', [field]: (event.target as HTMLInputElement).value || null });
  }

  onProduct(item: StockableItem) {
    this.#picked.set({ productId: item.productId, label: item.label });
    this.#navigate({ productId: String(item.productId) });
  }

  removeProduct() {
    this.#navigate({ productId: null });
  }

  clearFilters() {
    this.#navigate({ range: null, from: null, to: null, productId: null });
  }

  onSort(key: ConsumptionSortKey) {
    this.$sort.update((sort) => toggleSort(sort, key));
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
