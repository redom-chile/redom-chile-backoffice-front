import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import { SubscriptionStatus } from 'src/app/core/services/entitlements';
import { readId, readOption, readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import {
  formatClp,
  formatPlatformDate,
  getPlatformErrorMessage,
  PlatformBusinessFiltersDto,
  PlatformBusinessItemDto,
  PlatformService,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
} from '../../data-access';
import { subscriptionKeyDate } from '../../features/business-shared';

const PER_PAGE = 20;
type StatusFilter = SubscriptionStatus | 'none';
const STATUSES: readonly StatusFilter[] = ['trialing', 'active', 'past_due', 'expired', 'cancelled', 'none'];
const TRIAL_DAYS = ['3', '7', '15'] as const;

type BusinessesQuery = Readonly<{
  page: number;
  search: string;
  status: StatusFilter | null;
  planId: number | null;
  overdue: boolean;
  trialEndingInDays: number | null;
}>;

function toQuery(params: ParamMap): BusinessesQuery {
  const days = readOption(params, 'trialEndingInDays', TRIAL_DAYS);
  return {
    page: readPage(params),
    search: (params.get('search') ?? '').trim(),
    status: readOption<StatusFilter>(params, 'status', STATUSES),
    planId: readId(params, 'planId'),
    overdue: params.get('overdue') === 'true',
    trialEndingInDays: days ? Number(days) : null,
  };
}

/** Negocios con su plan y suscripción, con filtros en la URL. */
@Component({
  selector: 'app-platform-businesses',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-businesses.component.html',
})
export class PlatformBusinessesComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platform = inject(PlatformService);
  readonly #destroyRef = inject(DestroyRef);

  readonly statuses = STATUSES;
  readonly trialDays = TRIAL_DAYS.map(Number);
  readonly statusLabels = SUBSCRIPTION_STATUS_LABELS;
  readonly statusTones = SUBSCRIPTION_STATUS_TONES;
  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly keyDate = subscriptionKeyDate;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $search = signal(this.$query().search);
  readonly #search$ = new Subject<string>();

  readonly businesses = rxResource({
    params: (): PlatformBusinessFiltersDto => {
      const { page, search, status, planId, overdue, trialEndingInDays } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        search: search || undefined,
        status: status ?? undefined,
        planId: planId ?? undefined,
        overdue: overdue || undefined,
        trialEndingInDays: trialEndingInDays ?? undefined,
      };
    },
    stream: ({ params }) => this.#platform.getBusinesses(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.businesses.value()));
  readonly $error = computed(() => resultError(this.businesses.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly #plans = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  readonly $plans = computed(() => resultValue(this.#plans.value()) ?? []);

  readonly $hasFilters = computed(() => {
    const { search, status, planId, overdue, trialEndingInDays } = this.$query();
    return !!(search || status || planId || overdue || trialEndingInDays);
  });

  constructor() {
    this.#search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((search) => this.#navigate({ page: null, search: search.trim() || null }));
  }

  statusKey(business: PlatformBusinessItemDto): StatusFilter {
    return business.status ?? 'none';
  }

  handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value);
  }

  handleSelect(key: 'status' | 'planId' | 'trialEndingInDays', event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.#navigate({ page: null, [key]: value || null });
  }

  handleOverdue(event: Event) {
    this.#navigate({ page: null, overdue: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  handleClearFilters() {
    this.$search.set('');
    this.#search$.next('');
    this.#navigate({ page: null, search: null, status: null, planId: null, overdue: null, trialEndingInDays: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  open(id: number) {
    this.#router.navigate(['/platform/businesses', id]);
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
