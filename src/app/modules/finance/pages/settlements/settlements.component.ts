import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import {
  readDate,
  readId,
  readOption,
  resultError,
  resultValue,
  toRemoteResult,
} from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import {
  getFinanceErrorMessage,
  PaymentFeesService,
  PaymentMethod,
  SettlementFiltersDto,
  SettlementsDto,
} from '../../data-access';
import { formatDay } from '../../features';

// El efectivo no tiene abono: el backend lo excluye.
const METHODS: readonly PaymentMethod[] = ['debit', 'credit', 'transfer', 'other'];

type SettlementsQuery = Readonly<{
  from: string | null;
  to: string | null;
  locationId: number | null;
  method: PaymentMethod | null;
}>;

type SettlementRow = SettlementsDto['bySettlementDate'][number];
type SettlementDayGroup = Readonly<{
  date: string;
  settled: boolean;
  rows: SettlementRow[];
  payments: number;
  gross: number;
  fees: number;
  net: number;
}>;

function toQuery(params: ParamMap): SettlementsQuery {
  return {
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    locationId: readId(params, 'locationId'),
    method: readOption(params, 'method', METHODS),
  };
}

/** Plata por llegar: neto estimado de tarjetas y transferencias según la comisión y días de abono configurados. */
@Component({
  selector: 'app-settlements',
  imports: [NgTemplateOutlet, RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settlements.component.html',
})
export class SettlementsComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #fees = inject(PaymentFeesService);
  readonly #locations = inject(GetAllBusinessLocationsService);

  readonly formatCurrency = formatCurrency;
  readonly formatDay = formatDay;
  readonly methods = METHODS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly skeletonRows = [1, 2, 3, 4];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  readonly $locationOptions = computed(() =>
    (this.#locations.$locations() ?? []).map((location) => ({ id: location.id, name: location.name })),
  );
  readonly $showLocations = computed(() => this.$locationOptions().length > 1);

  // Sin fechas: el backend usa los últimos 30 días.
  readonly settlements = rxResource({
    params: (): SettlementFiltersDto => {
      const { from, to, locationId, method } = this.$query();
      return {
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
        locationId: locationId ?? undefined,
        method: method ?? undefined,
      };
    },
    stream: ({ params }) => this.#fees.settlements(params).pipe(toRemoteResult()),
  });

  readonly $data = computed(() => resultValue(this.settlements.value()));
  readonly $error = computed(() => resultError(this.settlements.value()));
  readonly $errorMessage = computed(() =>
    getFinanceErrorMessage(this.$error(), 'No se pudo cargar la plata por llegar.'),
  );
  readonly $isFirstLoad = computed(() => this.settlements.isLoading() && !this.$data());
  readonly $isEmpty = computed(() => (this.$data()?.totals.payments ?? 0) === 0);

  // Rango mostrado en los inputs: el de la URL o el que aplicó el backend.
  readonly $dateFrom = computed(() => this.$query().from ?? this.$data()?.dateFrom ?? '');
  readonly $dateTo = computed(() => this.$query().to ?? this.$data()?.dateTo ?? '');

  readonly $hasFilters = computed(() => {
    const { from, to, locationId, method } = this.$query();
    return [from, to, locationId, method].some((value) => value !== null);
  });

  // Filas agrupadas por fecha de abono, con subtotal del día.
  readonly $days = computed<SettlementDayGroup[]>(() => {
    const groups = new Map<string, { date: string; settled: boolean; rows: SettlementRow[] }>();
    for (const row of this.$data()?.bySettlementDate ?? []) {
      const group = groups.get(row.date) ?? { date: row.date, settled: row.settled, rows: [] };
      group.rows.push(row);
      groups.set(row.date, group);
    }
    return [...groups.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((group) => ({
        ...group,
        payments: group.rows.reduce((sum, row) => sum + row.payments, 0),
        gross: group.rows.reduce((sum, row) => sum + row.gross, 0),
        fees: group.rows.reduce((sum, row) => sum + row.fees, 0),
        net: group.rows.reduce((sum, row) => sum + row.net, 0),
      }));
  });

  onDate(key: 'from' | 'to', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.#navigate({ [key]: value || null });
  }

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ locationId: value > 0 ? String(value) : null });
  }

  onMethod(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.#navigate({ method: (METHODS as readonly string[]).includes(value) ? value : null });
  }

  clearFilters() {
    this.#navigate({ from: null, to: null, locationId: null, method: null });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
