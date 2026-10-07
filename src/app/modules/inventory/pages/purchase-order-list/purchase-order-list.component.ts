import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import {
  formatMoney,
  InventoryLocationStore,
  isInventoryDisabledError,
  PurchaseOrderFiltersDto,
  PurchaseOrderListItemDto,
  PurchaseOrdersService,
  PurchaseOrderStatus,
  SupplierDto,
  supplierLabel,
  SuppliersService,
} from '../../data-access';
import {
  formatDocumentDate,
  LoadErrorComponent,
  readDate,
  readId,
  readOption,
  readPage,
  resultError,
  resultValue,
  toRemoteResult,
} from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import { isOrderOverdue, PURCHASE_ORDER_STATUS_LABELS, PURCHASE_ORDER_STATUSES } from '../purchase-order-detail/data-access';
import { PurchaseOrderStatusChipComponent, ReceivedProgressComponent } from '../purchase-order-detail/ui';

const PER_PAGE = 20;

type OrderListQuery = Readonly<{
  page: number;
  status: PurchaseOrderStatus | null;
  locationId: number | null;
  supplierId: number | null;
  from: string | null;
  to: string | null;
}>;

function toQuery(params: ParamMap): OrderListQuery {
  return {
    page: readPage(params),
    status: readOption(params, 'status', PURCHASE_ORDER_STATUSES),
    locationId: readId(params, 'locationId'),
    supplierId: readId(params, 'supplierId'),
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

/** Órdenes de compra a proveedores con filtros en la URL. Una orden no mueve stock: recibirla crea una compra. */
@Component({
  selector: 'app-purchase-order-list',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    SkeletonComponent,
    PaginationTableComponent,
    InventoryDisabledComponent,
    LoadErrorComponent,
    PurchaseOrderStatusChipComponent,
    ReceivedProgressComponent,
  ],
  templateUrl: './purchase-order-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseOrderListComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #orders = inject(PurchaseOrdersService);
  readonly #suppliersService = inject(SuppliersService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly statuses = PURCHASE_ORDER_STATUSES;
  protected readonly statusLabels = PURCHASE_ORDER_STATUS_LABELS;
  protected readonly formatMoney = formatMoney;
  protected readonly formatDate = formatDocumentDate;
  protected readonly isOverdue = isOrderOverdue;
  protected readonly supplierLabel = supplierLabel;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  // Proveedores para el filtro; si fallan, el filtro queda solo con "Todos".
  readonly $suppliers = toSignal(
    this.#suppliersService.getAll().pipe(
      map((response) => response.data),
      catchError(() => of<SupplierDto[]>([])),
    ),
    { initialValue: [] as SupplierDto[] },
  );

  readonly orders = rxResource({
    params: (): PurchaseOrderFiltersDto | undefined => {
      if (this.$isDisabledBySettings()) return undefined;
      const { page, status, locationId, supplierId, from, to } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        status: status ?? undefined,
        locationId: locationId ?? undefined,
        supplierId: supplierId ?? undefined,
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
      };
    },
    stream: ({ params }) => this.#orders.list(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.orders.value()));
  readonly $error = computed(() => resultError(this.orders.value()));
  readonly $isDisabled = computed(() => this.$isDisabledBySettings() || isInventoryDisabledError(this.$error()));
  readonly $items = computed(() => this.$page()?.data ?? []);

  readonly $hasFilters = computed(() => {
    const { status, locationId, supplierId, from, to } = this.$query();
    return status !== null || locationId !== null || supplierId !== null || from !== null || to !== null;
  });

  orderNumber(order: PurchaseOrderListItemDto): string {
    return `#${order.id}`;
  }

  linesLabel(count: number): string {
    return `${count} ${count === 1 ? 'línea' : 'líneas'}`;
  }

  handleStatus(status: PurchaseOrderStatus | null) {
    this.#navigate({ page: null, status: status === this.$query().status ? null : status });
  }

  onSelect(key: 'locationId' | 'supplierId', event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ page: null, [key]: value > 0 ? String(value) : null });
  }

  onDate(key: 'from' | 'to', event: Event) {
    this.#navigate({ page: null, [key]: (event.target as HTMLInputElement).value || null });
  }

  handleClearFilters() {
    this.#navigate({ page: null, status: null, locationId: null, supplierId: null, from: null, to: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  open(order: PurchaseOrderListItemDto) {
    this.#router.navigate(['/inventory/purchase-orders', order.id]);
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
