import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { BillingPaymentDto, INTERVAL_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUS_TONES, PAYMENT_METHOD_LABELS } from 'src/app/modules/billing/data-access';
import { readPage, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatClp, formatPlatformDate, getPlatformErrorMessage, PlatformInvoiceDto, PlatformService } from '../../data-access';
import { PaymentActionsService } from '../../features/payment-actions';
import { PaymentReviewCountService } from '../../features/payment-review-count';
import { INVOICE_KIND_LABELS, PaymentTarget } from '../../features/payment-shared';

const PER_PAGE = 20;

type ReviewItem = Readonly<{ invoice: PlatformInvoiceDto; payment: BillingPaymentDto }>;

/** Transferencias informadas por los dueños que esperan confirmación (una tarjeta por pago pendiente). */
@Component({
  selector: 'app-platform-payments-review',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-payments-review.component.html',
})
export class PlatformPaymentsReviewComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #platform = inject(PlatformService);
  readonly #actions = inject(PaymentActionsService);
  readonly #reviewCount = inject(PaymentReviewCountService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly intervalLabels = INTERVAL_LABELS;
  readonly kindLabels = INVOICE_KIND_LABELS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly invoiceStatusLabels = INVOICE_STATUS_LABELS;
  readonly invoiceStatusTones = INVOICE_STATUS_TONES;
  readonly skeletonRows = [1, 2, 3];

  readonly $page = toSignal(this.#route.queryParamMap.pipe(map(readPage)), { initialValue: readPage(this.#route.snapshot.queryParamMap) });

  readonly invoices = rxResource({
    params: () => ({ pendingReview: true, page: this.$page(), perPage: PER_PAGE }),
    stream: ({ params }) => this.#platform.getInvoices(params).pipe(toRemoteResult()),
  });
  readonly $result = computed(() => resultValue(this.invoices.value()));
  readonly $error = computed(() => resultError(this.invoices.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));
  readonly $items = computed<ReviewItem[]>(() =>
    (this.$result()?.data ?? []).flatMap((invoice) => invoice.payments.filter((payment) => payment.status === 'pending').map((payment) => ({ invoice, payment }))),
  );
  /** Pago con una acción en curso (deshabilita sus botones). */
  readonly $busyId = signal<number | null>(null);

  handlePageChange(page: number) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { page: page > 1 ? String(page) : null }, queryParamsHandling: 'merge' });
  }

  reload() {
    this.invoices.reload();
    this.#reviewCount.refresh();
  }

  /** Lo que falta pagar del cobro (sin contar lo que está en revisión). */
  remaining(invoice: PlatformInvoiceDto): number {
    return Math.max(0, invoice.total - invoice.paidAmount);
  }

  confirm(item: ReviewItem) {
    this.#run(item, this.#actions.confirm(this.#target(item)));
  }

  reject(item: ReviewItem) {
    this.#run(item, this.#actions.reject(this.#target(item)));
  }

  #target({ invoice, payment }: ReviewItem): PaymentTarget {
    return { id: payment.id, amount: payment.amount, method: payment.method, reference: payment.reference, businessName: invoice.business.name };
  }

  #run(item: ReviewItem, action$: Observable<boolean>) {
    this.$busyId.set(item.payment.id);
    action$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (changed) => {
        this.$busyId.set(null);
        if (changed) this.#afterChange();
      },
      error: () => this.$busyId.set(null),
    });
  }

  /** Si se vació la última página, vuelve a la anterior. */
  #afterChange() {
    const page = this.$page();
    if (page > 1 && this.$items().length <= 1) {
      this.handlePageChange(page - 1);
      return;
    }
    this.invoices.reload();
  }
}
