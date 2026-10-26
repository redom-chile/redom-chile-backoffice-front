import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import { TabDirective, TabListDirective } from 'src/app/modules/public-menu/features/a11y-tabs';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { GetCustomersService } from './data-access';
import { CreateCustomerModalComponent, CreateCustomerModalResult, CustomerInsightsPanelComponent, CustomersTableComponent } from './features';

const PER_PAGE = 10;

type CustomersTab = 'list' | 'panel';
const TABS: ReadonlyArray<{ id: CustomersTab; label: string; icon: string }> = [
  { id: 'list', label: 'Lista', icon: 'list' },
  { id: 'panel', label: 'Panel', icon: 'insights' },
];

function toQuery(params: ParamMap) {
  const page = Number(params.get('page'));
  const tab: CustomersTab = params.get('tab') === 'panel' ? 'panel' : 'list';
  return { page: Number.isInteger(page) && page > 0 ? page : 1, q: params.get('q') ?? '', tab };
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [ReactiveFormsModule, TabDirective, TabListDirective, CustomerInsightsPanelComponent, HeaderDashboardComponent, ButtonComponent, IconComponent, EmptyStateComponent, CustomersTableComponent, CheckPermissionDirective],
  templateUrl: './customer-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly customersService = inject(GetCustomersService);

  protected readonly PERMISSIONS = PERMISSIONS;
  readonly tabs = TABS;

  readonly $query = toSignal(this.route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.route.snapshot.queryParamMap),
  });
  readonly $tab = computed(() => this.$query().tab);
  readonly search = new FormControl(this.$query().q, { nonNullable: true });

  readonly $response = this.customersService.$customers;
  readonly $customers = computed(() => this.$response()?.data ?? []);
  readonly $pagination = computed(() => this.$response()?.pagination ?? null);
  readonly $isLoading = computed(() => this.customersService.$isLoading() ?? false);
  readonly $hasError = computed(() => this.customersService.$error() !== undefined);
  readonly $isEmpty = computed(
    () => !this.$isLoading() && !this.$hasError() && !this.$query().q && this.$response() !== undefined && this.$pagination()?.totalItems === 0,
  );

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map(toQuery),
        // La lista se carga solo en su pestaña (y una vez por cambio de página o búsqueda).
        filter(({ tab }) => tab === 'list'),
        distinctUntilChanged((a, b) => a.page === b.page && a.q === b.q),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ page, q }) => this.customersService.load({ page, perPage: PER_PAGE, q: q || undefined }));

    this.search.valueChanges
      .pipe(debounceTime(350), map((value) => value.trim()), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navigate({ q: q || null, page: null }));
  }

  selectTab(tab: CustomersTab) {
    if (tab === this.$tab()) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'list' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  handlePageChange(page: number) {
    this.navigate({ page: page > 1 ? String(page) : null });
  }

  handleRetry() {
    this.customersService.retry();
  }

  handleCreate() {
    this.dialog
      .open<CreateCustomerModalComponent, void, CreateCustomerModalResult>(CreateCustomerModalComponent, {
        width: '480px',
        maxWidth: '95vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        if (result.kind === 'created') this.toast.show('Cliente creado', 'success');
        this.router.navigate(['/customers', result.id]);
      });
  }

  private navigate(queryParams: Record<string, string | null>) {
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
