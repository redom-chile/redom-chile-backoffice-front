import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map, Observable, of, Subject, switchMap } from 'rxjs';
import { readOption, readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  HeaderDashboardComponent,
  IconComponent,
  PaginationTableComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import { DiscountDto, DiscountFiltersDto, getPlatformErrorMessage, PlatformService } from '../../data-access';
import {
  discountIsLocked,
  discountValidity,
  formatDiscountDuration,
  formatDiscountRestrictions,
  formatDiscountValue,
} from '../../features/discount-format';
import { openDiscountFormModal } from '../../features/discount-form-modal';

const PER_PAGE = 20;
type ActiveFilter = 'true' | 'false';
const ACTIVE_OPTIONS: ActiveFilter[] = ['true', 'false'];

type DiscountsQuery = Readonly<{ page: number; search: string; isActive: ActiveFilter | null }>;

function toQuery(params: ParamMap): DiscountsQuery {
  return {
    page: readPage(params),
    search: (params.get('search') ?? '').trim(),
    isActive: readOption(params, 'isActive', ACTIVE_OPTIONS),
  };
}

/** Descuentos y cupones (SUPERADMIN). No se borran: se desactivan. */
@Component({
  selector: 'app-platform-discounts',
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-discounts.component.html',
})
export class PlatformDiscountsComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatValue = formatDiscountValue;
  readonly formatDuration = formatDiscountDuration;
  readonly validity = discountValidity;
  readonly isLocked = discountIsLocked;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly activeTabs: ReadonlyArray<{ value: ActiveFilter | null; label: string }> = [
    { value: 'true', label: 'Activos' },
    { value: 'false', label: 'Inactivos' },
    { value: null, label: 'Todos' },
  ];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $search = signal(this.$query().search);
  readonly #search$ = new Subject<string>();

  readonly discounts = rxResource({
    params: (): DiscountFiltersDto => {
      const { page, search, isActive } = this.$query();
      return { page, perPage: PER_PAGE, search: search || undefined, isActive: isActive === null ? undefined : isActive === 'true' };
    },
    stream: ({ params }) => this.#platform.getDiscounts(params).pipe(toRemoteResult()),
  });
  readonly $page = computed(() => resultValue(this.discounts.value()));
  readonly $error = computed(() => resultError(this.discounts.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly #plans = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  readonly $plans = computed(() => resultValue(this.#plans.value()) ?? []);

  readonly $hasFilters = computed(() => {
    const { search, isActive } = this.$query();
    return !!search || isActive !== null;
  });
  /** Descuento con una acción en curso (activar o desactivar). */
  readonly $busyId = signal<number | null>(null);

  constructor() {
    this.#search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.#destroyRef))
      .subscribe((search) => this.#navigate({ page: null, search: search.trim() || null }));
  }

  restrictions(discount: DiscountDto): string[] {
    return formatDiscountRestrictions(discount, this.$plans());
  }

  handleSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value);
  }

  handleActive(value: ActiveFilter | null) {
    this.#navigate({ page: null, isActive: value });
  }

  handleClearFilters() {
    this.$search.set('');
    this.#search$.next('');
    this.#navigate({ page: null, search: null, isActive: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  handleCreate() {
    this.#openForm();
  }

  handleEdit(discount: DiscountDto) {
    this.#openForm(discount);
  }

  handleToggleActive(discount: DiscountDto) {
    if (this.$busyId() !== null) return;
    const activate = !discount.isActive;
    const confirmed$: Observable<boolean | undefined> = activate
      ? of(true)
      : this.#dialog
          .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
            width: '440px',
            maxWidth: '95vw',
            data: {
              title: 'Desactivar descuento',
              message:
                `"${discount.name}" ya no se podrá aplicar a nuevas suscripciones.` +
                (discount.subscriptions ? ` Las ${discount.subscriptions} suscripciones que ya lo tienen lo mantienen.` : ''),
              confirmText: 'Desactivar',
              cancelText: 'Volver',
              tone: 'danger',
            },
          })
          .afterClosed();
    confirmed$
      .pipe(
        filter((confirmed) => !!confirmed),
        switchMap(() => {
          this.$busyId.set(discount.id);
          return this.#platform.updateDiscount(discount.id, { isActive: activate });
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.#toast.show(activate ? 'Descuento activado' : 'Descuento desactivado', 'success');
          this.discounts.reload();
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo cambiar el estado del descuento'), 'error');
        },
      });
  }

  #openForm(discount?: DiscountDto) {
    const plans = resultValue(this.#plans.value()) ?? undefined;
    openDiscountFormModal(this.#dialog, { discount, plans })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((saved) => {
        if (saved) this.discounts.reload();
      });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
