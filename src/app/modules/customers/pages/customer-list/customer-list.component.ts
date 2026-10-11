import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { GetCustomersService } from './data-access';
import { CreateCustomerModalComponent, CreateCustomerModalResult, CustomersTableComponent } from './features';

const PER_PAGE = 10;

function toQuery(params: ParamMap) {
  const page = Number(params.get('page'));
  return { page: Number.isInteger(page) && page > 0 ? page : 1, q: params.get('q') ?? '' };
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [ReactiveFormsModule, HeaderDashboardComponent, ButtonComponent, IconComponent, EmptyStateComponent, CustomersTableComponent, CheckPermissionDirective],
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

  readonly $query = toSignal(this.route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.route.snapshot.queryParamMap),
  });
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
      .pipe(map(toQuery), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ page, q }) => this.customersService.load({ page, perPage: PER_PAGE, q: q || undefined }));

    this.search.valueChanges
      .pipe(debounceTime(350), map((value) => value.trim()), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => this.navigate({ q: q || null, page: null }));
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
