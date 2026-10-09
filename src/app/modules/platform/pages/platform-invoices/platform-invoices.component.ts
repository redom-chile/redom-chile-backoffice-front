import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  BillingPaymentMethod,
  INTERVAL_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  InvoiceStatus,
  PAYMENT_METHOD_LABELS,
} from 'src/app/modules/billing/data-access';
import { readDate, readId, readOption, readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatClp, formatPlatformDate, getPlatformErrorMessage, PlatformInvoiceDto, PlatformInvoiceFiltersDto, PlatformService } from '../../data-access';
import { DiscountBusinessPickerComponent, PickedBusiness } from '../../features/discount-business-picker';
import { InvoicePaymentsComponent } from '../../features/invoice-payments';
import { PaymentActionsService } from '../../features/payment-actions';
import { INVOICE_KIND_LABELS } from '../../features/payment-shared';

const PER_PAGE = 20;
const STATUSES: readonly InvoiceStatus[] = ['pending', 'overdue', 'paid', 'void'];
const METHODS: readonly BillingPaymentMethod[] = ['transfer', 'cash', 'other', 'flow_card', 'flow_other'];

type InvoicesQuery = Readonly<{
  page: number;
  status: InvoiceStatus | null;
  businessId: number | null;
  from: string | null;
  to: string | null;
  method: BillingPaymentMethod | null;
}>;

function toQuery(params: ParamMap): InvoicesQuery {
  return {
    page: readPage(params),
    status: readOption(params, 'status', STATUSES),
    businessId: readId(params, 'businessId'),
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
    method: readOption(params, 'method', METHODS),
  };
}

/** Cobros de todos los negocios con sus pagos, filtros en la URL y las acciones del superadmin. */
@Component({
  selector: 'app-platform-invoices',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PaginationTableComponent,
    DiscountBusinessPickerComponent,
    InvoicePaymentsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-invoices.component.html',
})
export class PlatformInvoicesComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platform = inject(PlatformService);
  readonly #actions = inject(PaymentActionsService);

  readonly statuses = STATUSES;
  readonly methods = METHODS;
  readonly statusLabels = INVOICE_STATUS_LABELS;
  readonly statusTones = INVOICE_STATUS_TONES;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly intervalLabels = INTERVAL_LABELS;
  readonly kindLabels = INVOICE_KIND_LABELS;
  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  readonly invoices = rxResource({
    params: (): PlatformInvoiceFiltersDto => {
      const { page, status, businessId, from, to, method } = this.$query();
      return {
        page,
        perPage: PER_PAGE,
        status: status ?? undefined,
        businessId: businessId ?? undefined,
        from: from ?? undefined,
        to: to ?? undefined,
        method: method ?? undefined,
      };
    },
    stream: ({ params }) => this.#platform.getInvoices(params).pipe(toRemoteResult()),
  });
  readonly $result = computed(() => resultValue(this.invoices.value()));
  readonly $error = computed(() => resultError(this.invoices.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly $hasFilters = computed(() => {
    const { status, businessId, from, to, method } = this.$query();
    return !!(status || businessId || from || to || method);
  });

  // Nombre del negocio filtrado: el elegido en el buscador o, al recargar, el de sus cobros.
  readonly #pickedName = signal<PickedBusiness | null>(null);
  readonly $pickedBusiness = computed<PickedBusiness[]>(() => {
    const id = this.$query().businessId;
    if (!id) return [];
    const picked = this.#pickedName();
    if (picked?.id === id) return [picked];
    const name = this.$result()?.data.find((invoice) => invoice.business.id === id)?.business.name;
    return [{ id, name: name ?? `Negocio #${id}` }];
  });

  /** Cobros con el detalle de pagos abierto. */
  readonly $expanded = signal<ReadonlySet<number>>(new Set());

  isExpanded(id: number): boolean {
    return this.$expanded().has(id);
  }

  toggle(id: number) {
    this.$expanded.update((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  pendingCount(invoice: PlatformInvoiceDto): number {
    return invoice.payments.filter((payment) => payment.status === 'pending').length;
  }

  remaining(invoice: PlatformInvoiceDto): number {
    return invoice.status === 'void' ? 0 : Math.max(0, invoice.total - invoice.paidAmount);
  }

  handleSelect(key: 'status' | 'method', event: Event) {
    this.#navigate({ page: null, [key]: (event.target as HTMLSelectElement).value || null });
  }

  handleDate(key: 'from' | 'to', event: Event) {
    this.#navigate({ page: null, [key]: (event.target as HTMLInputElement).value || null });
  }

  handleBusiness(list: PickedBusiness[]) {
    // El buscador admite varios: se queda con el último elegido.
    const current = this.$query().businessId;
    const picked = [...list].reverse().find((business) => business.id !== current) ?? null;
    if (!list.length) {
      this.#pickedName.set(null);
      this.#navigate({ page: null, businessId: null });
      return;
    }
    if (!picked) return;
    this.#pickedName.set(picked);
    this.#navigate({ page: null, businessId: String(picked.id) });
  }

  handleClearFilters() {
    this.#pickedName.set(null);
    this.#navigate({ page: null, status: null, businessId: null, from: null, to: null, method: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  exportPayments() {
    this.#actions.exportPayments().subscribe();
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
