import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import { InventoryLocationStore, supplierLabel, SuppliersService } from 'src/app/modules/inventory/data-access';
import {
  formatDocumentDate,
  readDate,
  readId,
  readOption,
  readPage,
  resultError,
  resultValue,
  toRemoteResult,
} from 'src/app/modules/inventory/shared/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import {
  EXPENSE_STATUS_CLASSES,
  EXPENSE_STATUS_LABELS,
  ExpenseFiltersDto,
  ExpensesService,
  ExpenseStatus,
  getFinanceErrorMessage,
} from '../../data-access';

const PER_PAGE = 20;
const STATUSES: ExpenseStatus[] = ['pending', 'partial', 'paid', 'cancelled'];

type ExpenseListQuery = Readonly<{
  page: number;
  locationId: number | null;
  categoryId: number | null;
  supplierId: number | null;
  status: ExpenseStatus | null;
  from: string | null;
  to: string | null;
  search: string;
}>;

function toQuery(params: ParamMap): ExpenseListQuery {
  return {
    page: readPage(params),
    locationId: readId(params, 'locationId'),
    categoryId: readId(params, 'categoryId'),
    supplierId: readId(params, 'supplierId'),
    status: readOption<ExpenseStatus>(params, 'status', STATUSES),
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    search: (params.get('search') ?? '').trim(),
  };
}

/** Gastos (salidas que no son inventario) con filtros en la URL. */
@Component({
  selector: 'app-expense-list',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-list.component.html',
})
export class ExpenseListComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #expenses = inject(ExpensesService);
  readonly #suppliersService = inject(SuppliersService);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly statuses = STATUSES;
  readonly statusLabels = EXPENSE_STATUS_LABELS;
  readonly statusClasses = EXPENSE_STATUS_CLASSES;
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDocumentDate;
  readonly supplierLabel = supplierLabel;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $search = signal(this.$query().search);
  readonly #search$ = new Subject<string>();

  readonly expenses = rxResource({
    params: (): ExpenseFiltersDto => {
      const { page, locationId, categoryId, supplierId, status, from, to, search } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        locationId: locationId ?? undefined,
        categoryId: categoryId ?? undefined,
        supplierId: supplierId ?? undefined,
        status: status ?? undefined,
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
        search: search || undefined,
      };
    },
    stream: ({ params }) => this.#expenses.list(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.expenses.value()));
  readonly $error = computed(() => resultError(this.expenses.value()));
  readonly $errorMessage = computed(() => getFinanceErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly #categories = rxResource({ stream: () => this.#expenses.getCategories(true).pipe(toRemoteResult()) });
  readonly $categories = computed(() => resultValue(this.#categories.value()) ?? []);
  readonly #suppliers = rxResource({ stream: () => this.#suppliersService.getAll().pipe(toRemoteResult()) });
  readonly $suppliers = computed(() => resultValue(this.#suppliers.value())?.data ?? []);

  readonly $hasFilters = computed(() => {
    const { locationId, categoryId, supplierId, status, from, to, search } = this.$query();
    return !!(locationId || categoryId || supplierId || status || from || to || search);
  });

  constructor() {
    this.#search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((search) => this.#navigate({ page: null, search: search.trim() || null }));
  }

  handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value);
  }

  handleSelect(key: 'locationId' | 'categoryId' | 'supplierId' | 'status', event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.#navigate({ page: null, [key]: value || null });
  }

  handleDate(key: 'from' | 'to', event: Event) {
    this.#navigate({ page: null, [key]: (event.target as HTMLInputElement).value || null });
  }

  handleClearFilters() {
    this.$search.set('');
    this.#search$.next('');
    this.#navigate({ page: null, locationId: null, categoryId: null, supplierId: null, status: null, from: null, to: null, search: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  open(id: number) {
    this.#router.navigate(['/finance/expenses', id]);
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
