import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SuppliersService, supplierLabel } from 'src/app/modules/inventory/data-access';
import { readId, readOption, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { dueLabel, getFinanceErrorMessage, PAYABLE_TYPE_LABELS, PayableFiltersDto, PayableItemDto, PayablesService, PayableType } from '../../data-access';
import { formatDay, localDate, openPayPayableModal } from '../../features';
import { PayablesHelpComponent } from './payables-help.component';

type DueFilter = 'week' | 'overdue';
const DUE_FILTERS: readonly DueFilter[] = ['week', 'overdue'];
const TYPES: readonly PayableType[] = ['expense', 'purchase'];

type PayablesQuery = Readonly<{
  due: DueFilter | null;
  type: PayableType | null;
  supplierId: number | null;
  locationId: number | null;
}>;

function toQuery(params: ParamMap): PayablesQuery {
  return {
    due: readOption(params, 'due', DUE_FILTERS),
    type: readOption(params, 'type', TYPES),
    supplierId: readId(params, 'supplierId'),
    locationId: readId(params, 'locationId'),
  };
}

/** Estado de navegación hacia el detalle de una compra (evita volver a pedir la lista). */
export type PurchasePaymentsState = Readonly<{ payable?: PayableItemDto }>;

/** Cuentas por pagar: gastos y compras con saldo, la que vence primero arriba. Filtros en la URL. */
@Component({
  selector: 'app-payables',
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PayablesHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payables.component.html',
})
export class PayablesComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #payables = inject(PayablesService);
  readonly #suppliers = inject(SuppliersService);
  readonly #locations = inject(GetAllBusinessLocationsService);

  readonly formatCurrency = formatCurrency;
  readonly formatDay = formatDay;
  readonly dueLabel = dueLabel;
  readonly typeLabels = PAYABLE_TYPE_LABELS;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  readonly #supplierList = rxResource({
    stream: () => this.#suppliers.getAll(1, 100).pipe(
      map((page) => page.data.map((supplier) => ({ id: supplier.id, name: supplierLabel(supplier) }))),
      catchError(() => of([])),
    ),
  });
  readonly $supplierOptions = computed(() => this.#supplierList.value() ?? []);
  readonly $locationOptions = computed(() => (this.#locations.$locations() ?? []).map((location) => ({ id: location.id, name: location.name })));
  readonly $showLocations = computed(() => this.$locationOptions().length > 1);

  readonly payables = rxResource({
    params: (): PayableFiltersDto => {
      const { due, type, supplierId, locationId } = this.$query();
      return {
        type: type ?? undefined,
        supplierId: supplierId ?? undefined,
        locationId: locationId ?? undefined,
        ...(due === 'week' ? { dueBefore: localDate(7) } : {}),
        ...(due === 'overdue' ? { overdueOnly: true } : {}),
      };
    },
    stream: ({ params }) => this.#payables.list(params).pipe(toRemoteResult()),
  });

  readonly $data = computed(() => resultValue(this.payables.value()));
  readonly $items = computed(() => this.$data()?.items ?? []);
  readonly $totals = computed(() => this.$data()?.totals ?? null);
  readonly $error = computed(() => resultError(this.payables.value()));
  readonly $errorMessage = computed(() => getFinanceErrorMessage(this.$error(), 'No se pudieron cargar las cuentas por pagar.'));
  readonly $isFirstLoad = computed(() => this.payables.isLoading() && !this.$data());

  readonly $hasFilters = computed(() => {
    const { due, type, supplierId, locationId } = this.$query();
    return [due, type, supplierId, locationId].some((value) => value !== null);
  });

  open(item: PayableItemDto) {
    if (item.type === 'expense') {
      this.#router.navigate(['/finance/expenses', item.id]);
      return;
    }
    const state: PurchasePaymentsState = { payable: item };
    this.#router.navigate(['/finance/purchases', item.id], { state });
  }

  pay(item: PayableItemDto, event?: Event) {
    event?.stopPropagation();
    openPayPayableModal(this.#dialog, {
      type: item.type,
      id: item.id,
      description: item.description,
      balance: item.balance,
      locationId: item.locationId,
    }).subscribe((result) => {
      if (result) this.payables.reload();
    });
  }

  setDue(due: DueFilter | null) {
    this.#navigate({ due });
  }

  setType(type: PayableType | null) {
    this.#navigate({ type });
  }

  onSelect(key: 'supplierId' | 'locationId', event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ [key]: value > 0 ? String(value) : null });
  }

  clearFilters() {
    this.#navigate({ due: null, type: null, supplierId: null, locationId: null });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
