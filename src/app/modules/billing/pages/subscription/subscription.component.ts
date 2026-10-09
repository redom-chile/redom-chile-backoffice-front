import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { filter, Observable } from 'rxjs';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { hasApiErrorCode } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  HeaderDashboardComponent,
  IconComponent,
  PaginationTableComponent,
  SkeletonComponent,
  ToastService,
} from 'src/ui';
import {
  BillingService,
  formatClp,
  getBillingErrorMessage,
  INTERVAL_LABELS,
  INTERVAL_SUFFIX,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  InvoiceWithPaymentsDto,
  OwnerSubscriptionDto,
} from '../../data-access';
import { BankTransferInfoComponent } from '../../features/bank-transfer-info';
import {
  BillingDatePipe,
  DISCOUNT_DURATION_LABELS,
  formatBillingDate,
  injectBillingTimeZone,
  invoiceBalance,
  invoiceReportable,
  invoiceTitle,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
} from '../../features/billing-format';
import { InvoicePaymentsComponent } from '../../features/invoice-payments';
import { openReportTransferModal } from '../../features/report-transfer-modal';

const HISTORY_PER_PAGE = 10;

/** Mi suscripción (solo el dueño): plan, próximo cobro, cobros pendientes con transferencia, cupón, historial y cancelación. */
@Component({
  selector: 'app-subscription',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    HeaderDashboardComponent,
    IconComponent,
    PaginationTableComponent,
    SkeletonComponent,
    BankTransferInfoComponent,
    BillingDatePipe,
    InvoicePaymentsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription.component.html',
})
export class SubscriptionComponent {
  readonly #billing = inject(BillingService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #whoami = inject(WhoamiService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly $timeZone = injectBillingTimeZone();
  readonly statusLabels = SUBSCRIPTION_STATUS_LABELS;
  readonly statusTones = SUBSCRIPTION_STATUS_TONES;
  readonly invoiceStatusLabels = INVOICE_STATUS_LABELS;
  readonly invoiceStatusTones = INVOICE_STATUS_TONES;
  readonly intervalLabels = INTERVAL_LABELS;
  readonly intervalSuffix = INTERVAL_SUFFIX;
  readonly clp = formatClp;
  readonly balance = invoiceBalance;
  readonly reportable = invoiceReportable;

  /** undefined mientras no llega whoami; false si no es el dueño (ni SUPERADMIN). */
  readonly #canSee = computed(() => {
    if (this.#whoami.$whoami() === undefined) return undefined;
    return this.#entitlements.$isOwner() || this.#entitlements.$isSuperAdmin();
  });

  readonly #subscriptionResource = rxResource({
    params: () => (this.#canSee() ? true : undefined),
    stream: () => this.#billing.getSubscription().pipe(toRemoteResult()),
  });
  readonly $page = signal(1);
  readonly #invoicesResource = rxResource({
    params: () => (this.#canSee() ? this.$page() : undefined),
    stream: ({ params }) => this.#billing.getInvoices(params, HISTORY_PER_PAGE).pipe(toRemoteResult()),
  });

  readonly $subscription = computed(() => resultValue(this.#subscriptionResource.value()));
  readonly #error = computed(() => resultError(this.#subscriptionResource.value()));
  readonly $ownerRequired = computed(() => this.#canSee() === false || hasApiErrorCode(this.#error(), 'BILLING_OWNER_REQUIRED'));
  readonly $failed = computed(() => !!this.#error() && !this.$ownerRequired());
  readonly $isLoading = computed(() => !this.$ownerRequired() && !this.$failed() && !this.$subscription());

  readonly $history = computed(() => resultValue(this.#invoicesResource.value()));
  readonly $historyFailed = computed(() => !!resultError(this.#invoicesResource.value()));
  readonly $historyLoading = this.#invoicesResource.isLoading;

  /** Período/prueba hasta cuando sigue el plan si se cancela. */
  readonly $endsAt = computed(() => {
    const value = this.$subscription();
    if (!value) return null;
    return value.status === 'trialing' ? (value.trialEndsAt ?? value.currentPeriodEnd) : (value.currentPeriodEnd ?? value.trialEndsAt);
  });

  readonly $canCancel = computed(() => {
    const value = this.$subscription();
    if (!value || value.cancelAtPeriodEnd) return false;
    if (value.status === 'trialing') return true;
    return (value.status === 'active' || value.status === 'past_due') && value.price !== null;
  });

  readonly $discountLabel = computed(() => {
    const discount = this.$subscription()?.discount;
    if (!discount) return null;
    const value = discount.type === 'percent' ? `${discount.value} %` : formatClp(discount.value);
    const left = this.$subscription()?.discountPeriodsLeft;
    const duration =
      discount.duration === 'repeating' && left ? `en ${left === 1 ? 'el próximo cobro' : `los próximos ${left} cobros`}` : DISCOUNT_DURATION_LABELS[discount.duration];
    return `${discount.name}${discount.code ? ` (${discount.code})` : ''}: ${value} de descuento ${duration}`;
  });

  readonly coupon = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] });
  readonly $busy = signal<'coupon' | 'cancel' | 'resume' | null>(null);

  invoiceTitle(invoice: InvoiceWithPaymentsDto): string {
    return invoiceTitle(invoice, INTERVAL_LABELS);
  }

  /** Un cobro con una transferencia rechazada y nada en revisión: se puede informar de nuevo. */
  hasRejected(invoice: InvoiceWithPaymentsDto): boolean {
    return invoice.payments.some((payment) => payment.status === 'rejected');
  }

  reload() {
    this.#subscriptionResource.reload();
    this.#invoicesResource.reload();
  }

  handlePage(page: number) {
    this.$page.set(page);
  }

  handleReport(invoice: InvoiceWithPaymentsDto) {
    openReportTransferModal(this.#dialog, { invoice, timeZone: this.$timeZone() })
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#afterChange());
  }

  handleCoupon() {
    if (this.$busy()) return;
    const code = this.coupon.value.trim().toUpperCase();
    if (!code) {
      this.coupon.markAsTouched();
      this.#toast.show('Ingresa el código del cupón', 'warning');
      return;
    }
    this.#run('coupon', this.#billing.applyCoupon(code), 'Cupón aplicado a tus próximos cobros', 'No se pudo aplicar el cupón', () =>
      this.coupon.reset(),
    );
  }

  handleResume() {
    if (this.$busy()) return;
    this.#run('resume', this.#billing.resume(), 'Listo: tu suscripción sigue activa', 'No se pudo reanudar la suscripción');
  }

  handleCancel() {
    if (this.$busy()) return;
    const date = formatBillingDate(this.$endsAt(), this.$timeZone());
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Cancelar suscripción',
          message: `Seguirás con tu plan hasta el ${date}. Después pasarás a Free. No se borra ningún dato.`,
          confirmText: 'Cancelar suscripción',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() =>
        this.#run('cancel', this.#billing.cancel(), `Tu suscripción se cancela el ${date}`, 'No se pudo cancelar la suscripción'),
      );
  }

  #run(
    kind: 'coupon' | 'cancel' | 'resume',
    request: Observable<OwnerSubscriptionDto>,
    success: string,
    fallback: string,
    done?: () => void,
  ) {
    this.$busy.set(kind);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (subscription) => {
        this.$busy.set(null);
        this.#subscriptionResource.set({ ok: true, value: subscription });
        this.#toast.show(success, 'success');
        done?.();
        this.#afterChange();
      },
      error: (error: unknown) => {
        this.$busy.set(null);
        this.#toast.show(getBillingErrorMessage(error, fallback), 'error');
      },
    });
  }

  #afterChange() {
    this.reload();
    this.#entitlements.refresh();
  }
}
