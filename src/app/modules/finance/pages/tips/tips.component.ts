import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { readDate, readId, readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { getFinanceErrorMessage, TIP_MODE_LABELS, TipPayoutFiltersDto, TipsPeriodFiltersDto, TipsService } from '../../data-access';
import { formatPaidAt } from '../../features/payable-payments/payable-format';
import { tipPeriodLabel } from '../../features/tip-receipt-print';
import { TipsHelpComponent } from './tips-help.component';

const PER_PAGE = 20;

type TipsQuery = Readonly<{
  // Período de las pendientes (fecha del pago).
  from: string | null;
  to: string | null;
  locationId: number | null;
  // Historial: fecha de la liquidación.
  paidFrom: string | null;
  paidTo: string | null;
  cancelled: boolean;
  page: number;
}>;

function toQuery(params: ParamMap): TipsQuery {
  return {
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    locationId: readId(params, 'locationId'),
    paidFrom: readDate(params, 'paidFrom'),
    paidTo: readDate(params, 'paidTo'),
    cancelled: params.get('cancelled') === '1',
    page: readPage(params),
  };
}

/** Propinas: lo pendiente por pagar al equipo (por mesero) y el historial de liquidaciones. Filtros en la URL. */
@Component({
  selector: 'app-tips',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent, TipsHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tips.component.html',
})
export class TipsComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #tips = inject(TipsService);
  readonly #locations = inject(GetAllBusinessLocationsService);

  readonly formatCurrency = formatCurrency;
  readonly formatPaidAt = formatPaidAt;
  readonly periodLabel = tipPeriodLabel;
  readonly modeLabels = TIP_MODE_LABELS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly skeletonRows = [1, 2, 3];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  readonly $locationOptions = computed(() => (this.#locations.$locations() ?? []).map((location) => ({ id: location.id, name: location.name })));
  readonly $showLocations = computed(() => this.$locationOptions().length > 1);

  // ---------- Pendientes ----------
  readonly pending = rxResource({
    params: (): TipsPeriodFiltersDto => {
      const { from, to, locationId } = this.$query();
      return { dateFrom: from ?? undefined, dateTo: to ?? undefined, locationId: locationId ?? undefined };
    },
    stream: ({ params }) => this.#tips.pending(params).pipe(toRemoteResult()),
  });
  readonly $pending = computed(() => resultValue(this.pending.value()));
  readonly $pendingError = computed(() => resultError(this.pending.value()));
  readonly $pendingErrorMessage = computed(() => getFinanceErrorMessage(this.$pendingError(), 'No se pudieron cargar las propinas pendientes.'));
  readonly $hasPendingPeriod = computed(() => !!(this.$query().from || this.$query().to));

  // ---------- Historial ----------
  readonly payouts = rxResource({
    params: (): TipPayoutFiltersDto => {
      const { locationId, paidFrom, paidTo, cancelled, page } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        locationId: locationId ?? undefined,
        dateFrom: paidFrom ?? undefined,
        dateTo: paidTo ?? undefined,
        includeCancelled: cancelled || undefined,
      };
    },
    stream: ({ params }) => this.#tips.payouts(params).pipe(toRemoteResult()),
  });
  readonly $payoutsPage = computed(() => resultValue(this.payouts.value()));
  readonly $payoutsError = computed(() => resultError(this.payouts.value()));
  readonly $payoutsErrorMessage = computed(() => getFinanceErrorMessage(this.$payoutsError(), 'No se pudo cargar el historial.'));
  readonly $hasHistoryFilters = computed(() => !!(this.$query().paidFrom || this.$query().paidTo || this.$query().cancelled));

  readonly $newPayoutParams = computed(() => {
    const { from, to, locationId } = this.$query();
    return { from, to, locationId };
  });

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ locationId: value > 0 ? String(value) : null, page: null });
  }

  onDate(key: 'from' | 'to' | 'paidFrom' | 'paidTo', event: Event) {
    const value = (event.target as HTMLInputElement).value || null;
    this.#navigate(key === 'paidFrom' || key === 'paidTo' ? { [key]: value, page: null } : { [key]: value });
  }

  toggleCancelled(event: Event) {
    this.#navigate({ cancelled: (event.target as HTMLInputElement).checked ? '1' : null, page: null });
  }

  clearPeriod() {
    this.#navigate({ from: null, to: null });
  }

  clearHistoryFilters() {
    this.#navigate({ paidFrom: null, paidTo: null, cancelled: null, page: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  openPayout(id: number) {
    this.#router.navigate(['/finance/tips/payouts', id]);
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
