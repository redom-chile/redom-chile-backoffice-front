import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { HeaderDashboardComponent, IconComponent } from 'src/ui';
import {
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  MOVEMENT_TYPE_OPTIONS,
  StockMovementFiltersDto,
  StockMovementType,
} from '../../data-access';
import { InventoryDisabledComponent } from '../../ui';
import {
  LoadErrorComponent,
  MovementsTableComponent,
  productLabel,
  readDate,
  readId,
  readOption,
  readPage,
  resultError,
  resultValue,
  toRemoteResult,
} from '../../shared';

const PER_PAGE = 25;
const MOVEMENT_TYPES = MOVEMENT_TYPE_OPTIONS.map((option) => option.value);

type KardexQuery = Readonly<{
  page: number;
  locationId: number | null;
  variationId: number | null;
  productId: number | null;
  documentId: number | null;
  type: StockMovementType | null;
  from: string | null;
  to: string | null;
}>;

function toQuery(params: ParamMap): KardexQuery {
  return {
    page: readPage(params),
    locationId: readId(params, 'locationId'),
    variationId: readId(params, 'variationId'),
    productId: readId(params, 'productId'),
    documentId: readId(params, 'documentId'),
    type: readOption<StockMovementType>(params, 'type', MOVEMENT_TYPES),
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

/**
 * Kardex: historial de movimientos de stock, del más reciente al más antiguo.
 * Aquí el local es un filtro opcional y no cambia el local elegido en el resto del inventario.
 */
@Component({
  selector: 'app-kardex',
  imports: [HeaderDashboardComponent, IconComponent, InventoryDisabledComponent, LoadErrorComponent, MovementsTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kardex.component.html',
})
export class KardexComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly typeOptions = MOVEMENT_TYPE_OPTIONS;

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  readonly movements = rxResource({
    params: (): StockMovementFiltersDto | undefined => {
      if (this.#isDisabledBySettings()) return undefined;
      const { page, locationId, variationId, productId, documentId, type, from, to } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        locationId: locationId ?? undefined,
        variationId: variationId ?? undefined,
        // Con variación no hace falta el producto.
        productId: variationId ? undefined : (productId ?? undefined),
        documentId: documentId ?? undefined,
        movementType: type ?? undefined,
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
      };
    },
    stream: ({ params }) => this.#inventory.getMovements(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.movements.value()));
  readonly $error = computed(() => resultError(this.movements.value()));
  // Inventario apagado (por configuración o por el 409 del backend): solo la pantalla "Activar inventario".
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));

  /** Chip "Producto: X": el nombre sale del primer movimiento (todos son del mismo producto). */
  readonly $productChip = computed(() => {
    const { variationId, productId } = this.$query();
    if (!variationId && !productId) return null;
    const first = this.$page()?.data[0];
    if (!first) return variationId ? `Variación #${variationId}` : `Producto #${productId}`;
    return variationId ? productLabel(first.productName, first.variationName) : first.productName;
  });

  readonly $hasFilters = computed(() => {
    const { locationId, variationId, productId, documentId, type, from, to } = this.$query();
    return [locationId, variationId, productId, documentId, type, from, to].some((value) => value !== null);
  });

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ locationId: value > 0 ? String(value) : null });
  }

  onType(event: Event) {
    this.#navigate({ type: (event.target as HTMLSelectElement).value || null });
  }

  onDate(field: 'from' | 'to', event: Event) {
    this.#navigate({ [field]: (event.target as HTMLInputElement).value || null });
  }

  removeProduct() {
    this.#navigate({ variationId: null, productId: null });
  }

  removeDocument() {
    this.#navigate({ documentId: null });
  }

  clearFilters() {
    this.#navigate({ locationId: null, variationId: null, productId: null, documentId: null, type: null, from: null, to: null });
  }

  handlePageChange(page: number) {
    this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { page: page > 1 ? String(page) : null },
      queryParamsHandling: 'merge',
    });
  }

  // Cualquier cambio de filtro vuelve a la página 1.
  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { ...queryParams, page: null }, queryParamsHandling: 'merge' });
  }
}
