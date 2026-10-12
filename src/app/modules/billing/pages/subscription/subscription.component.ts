import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, Observable } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { hasApiErrorCode } from 'src/app/core/utils/api-error';
import { CheckPermissionDirective } from 'src/app/shared/directives';
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
  CheckoutResultDto,
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
  canOfferTrial,
  cardLabel,
  DISCOUNT_DURATION_LABELS,
  formatBillingDate,
  goToFlow,
  hideTrial,
  injectBillingTimeZone,
  invoiceBalance,
  invoiceReportable,
  invoiceTitle,
  isTrialHidden,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
} from '../../features/billing-format';
import { InvoicePaymentsComponent } from '../../features/invoice-payments';
import { openReportTransferModal } from '../../features/report-transfer-modal';
import { openCheckoutModal } from '../../features/checkout-modal';

const HISTORY_PER_PAGE = 10;
/** Pago en proceso en Flow: se vuelve a consultar una vez. */
const PENDING_RECHECK_MS = 60_000;

type Busy = 'coupon' | 'cancel' | 'resume' | 'card' | 'remove-card' | 'trial' | `pay-${number}`;

/** Aviso arriba de la página tras volver de Flow o cobrar con tarjeta. */
type FlowNotice = Readonly<{
  tone: 'success' | 'warning' | 'danger';
  icon: string;
  title: string;
  text: string | null;
  /** Rechazo: reintentar con otra tarjeta o pagar por transferencia. */
  retry: boolean;
}>;

const NOTICE_TONES: Record<FlowNotice['tone'], string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const CARD_ERRORS: Record<string, string> = {
  rejected: 'No se registró la tarjeta (cancelaste o no es válida)',
  expired: 'El enlace venció. Inténtalo de nuevo',
  provider: 'Flow no respondió. Inténtalo más tarde',
};

/**
 * Mi suscripción (solo el dueño): plan, medio de pago (tarjeta en Flow o transferencia), cobros pendientes, cupón,
 * historial y cancelación. Flow vuelve acá con el resultado en la query (/billing?card=…&payment=…).
 */
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
    CheckPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription.component.html',
})
export class SubscriptionComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  readonly #billing = inject(BillingService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #whoami = inject(WhoamiService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #destroyRef = inject(DestroyRef);
  #recheckTimer: ReturnType<typeof setTimeout> | null = null;

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
  readonly $busy = signal<Busy | null>(null);
  /** El navegador va camino a Flow: todo deshabilitado. */
  readonly $redirecting = signal(false);
  readonly $notice = signal<FlowNotice | null>(null);
  readonly noticeTones = NOTICE_TONES;

  readonly #businessId = computed(() => this.#whoami.$whoami()?.user.restaurantId ?? null);
  readonly $card = computed(() => cardLabel(this.$subscription()?.card ?? null));

  /** Invitación a la prueba de Pro con tarjeta (plan Free sin prueba; se oculta ante TRIAL_NOT_AVAILABLE). */
  readonly $showTrial = computed(() => {
    const entitlements = this.#entitlements.$entitlements();
    if (!entitlements || !this.#entitlements.$isOwner() || this.#entitlements.$isSuperAdmin()) return false;
    const sub = this.$subscription();
    return canOfferTrial(entitlements.plan.code, sub ? sub.status : null) && !isTrialHidden(this.#businessId());
  });

  constructor() {
    this.#destroyRef.onDestroy(() => this.#clearRecheck());
    this.#readFlowReturn();
  }

  invoiceTitle(invoice: InvoiceWithPaymentsDto): string {
    return invoiceTitle(invoice, INTERVAL_LABELS);
  }

  /** Un cobro con una transferencia rechazada y nada en revisión: se puede informar de nuevo. */
  hasRejected(invoice: InvoiceWithPaymentsDto): boolean {
    return invoice.payments.some((payment) => payment.status === 'rejected');
  }

  /** Plan vencido: compra nueva del mismo plan y precio (action purchase). */
  handleReactivate() {
    const sub = this.$subscription();
    if (!sub?.price) return;
    openCheckoutModal(this.#dialog, { plan: sub.plan, price: sub.price, subscription: sub, timeZone: this.$timeZone() })
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe((result) => {
        // Con tarjeta el modal ya llevó a Flow o recargó esta página con el resultado del cobro.
        if (result.redirectUrl || result.charge) return;
        this.#entitlements.refresh();
        this.#toast.show('Generamos tu cobro. Transfiere y avísanos con "Ya transferí".', 'success');
        this.reload();
      });
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
    kind: Busy,
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

  handleAddCard() {
    if (this.$busy() || this.$redirecting()) return;
    this.$busy.set('card');
    this.#billing
      .addCard()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: ({ redirectUrl }) => this.#redirect(redirectUrl),
        error: (error: unknown) => {
          this.$busy.set(null);
          this.#toast.show(getBillingErrorMessage(error, 'No pudimos abrir el formulario de Flow'), 'error');
        },
      });
  }

  handleRemoveCard() {
    if (this.$busy() || this.$redirecting()) return;
    this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Quitar tarjeta',
          message: 'Los próximos cobros pasarán a transferencia. Puedes agregar una tarjeta cuando quieras.',
          confirmText: 'Quitar tarjeta',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() =>
        this.#run('remove-card', this.#billing.removeCard(), 'Quitamos tu tarjeta: los próximos cobros son por transferencia', 'No se pudo quitar la tarjeta'),
      );
  }

  /** Vuelve a cobrar el período pendiente a la tarjeta registrada (checkout del mismo precio). */
  handlePayWithCard(invoice: InvoiceWithPaymentsDto) {
    if (this.$busy() || this.$redirecting()) return;
    const priceId = this.$subscription()?.price?.id ?? invoice.priceId;
    this.$busy.set(`pay-${invoice.id}`);
    this.#billing
      .checkout({ priceId, method: 'flow' })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => this.#handleCardCheckout(result),
        error: (error: unknown) => {
          this.$busy.set(null);
          this.#toast.show(getBillingErrorMessage(error, 'No se pudo cobrar a tu tarjeta'), 'error');
        },
      });
  }

  handleStartTrial() {
    if (this.$busy() || this.$redirecting()) return;
    this.$busy.set('trial');
    this.#billing
      .startTrial()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: ({ redirectUrl }) => this.#redirect(redirectUrl),
        error: (error: unknown) => {
          this.$busy.set(null);
          if (hasApiErrorCode(error, 'TRIAL_NOT_AVAILABLE')) hideTrial(this.#businessId());
          this.#toast.show(getBillingErrorMessage(error, 'No pudimos activar la prueba'), 'error');
        },
      });
  }

  /** "Pagar por transferencia" del aviso de rechazo: lleva a los cobros pendientes. */
  scrollToOpenInvoices() {
    this.$notice.set(null);
    document.getElementById('sub-open-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  dismissNotice() {
    this.$notice.set(null);
  }

  #redirect(redirectUrl: string) {
    this.$redirecting.set(true);
    goToFlow(redirectUrl);
  }

  #handleCardCheckout(result: CheckoutResultDto) {
    if (result.redirectUrl) {
      this.#toast.show('Te llevamos a Flow para registrar tu tarjeta', 'success');
      this.#redirect(result.redirectUrl);
      return;
    }
    this.$busy.set(null);
    this.#subscriptionResource.set({ ok: true, value: result.subscription });
    if (result.charge) this.#showPayment(result.charge.status, result.charge.message);
    this.#afterChange();
  }

  /** Lee la vuelta desde Flow (o desde el checkout con tarjeta), avisa y limpia la query. */
  #readFlowReturn() {
    const query = this.#route.snapshot.queryParamMap;
    const card = query.get('card');
    const payment = query.get('payment');
    const trial = query.get('trial');
    if (!card && !payment && !trial) return;
    const state = (typeof history !== 'undefined' ? history.state : null) as { chargeMessage?: string | null } | null;

    if (card === 'error') {
      const text = CARD_ERRORS[query.get('reason') ?? ''] ?? 'No se registró la tarjeta. Inténtalo de nuevo';
      this.#toast.show(text, 'error');
      this.$notice.set({ tone: 'danger', icon: 'credit_card_off', title: text, text: null, retry: false });
    } else if (trial === 'started') {
      const text = 'Tu prueba gratis de 15 días del plan Pro comenzó';
      this.#toast.show(text, 'success');
      this.$notice.set({ tone: 'success', icon: 'rocket_launch', title: text, text: 'Ya puedes usar todas las funciones de Pro.', retry: false });
    } else if (payment === 'paid' || payment === 'rejected' || payment === 'pending') {
      this.#showPayment(payment, state?.chargeMessage ?? null);
    } else if (card === 'ok') {
      this.#toast.show('Tarjeta registrada', 'success');
    }

    this.#entitlements.refresh();
    this.#router.navigate([], { relativeTo: this.#route, queryParams: {}, replaceUrl: true });
  }

  #showPayment(status: 'paid' | 'rejected' | 'pending', message: string | null) {
    switch (status) {
      case 'paid':
        this.#toast.show('¡Listo! Tu plan está activo', 'success');
        this.$notice.set({ tone: 'success', icon: 'verified', title: '¡Listo! Tu plan está activo', text: null, retry: false });
        return;
      case 'rejected':
        this.#toast.show(message ? `El banco rechazó el cobro: ${message}` : 'El banco rechazó el cobro', 'error');
        this.$notice.set({
          tone: 'danger',
          icon: 'credit_card_off',
          title: 'El banco rechazó el cobro',
          text: message ?? 'Prueba con otra tarjeta o paga por transferencia.',
          retry: true,
        });
        return;
      case 'pending':
        this.#toast.show('Pago en proceso: te avisaremos cuando se confirme', 'warning');
        this.$notice.set({
          tone: 'warning',
          icon: 'hourglass_top',
          title: 'Pago en proceso',
          text: 'Flow todavía está procesando el cobro. Te avisaremos cuando se confirme.',
          retry: false,
        });
        this.#scheduleRecheck();
        return;
    }
  }

  #scheduleRecheck() {
    this.#clearRecheck();
    this.#recheckTimer = setTimeout(() => {
      this.#recheckTimer = null;
      this.#afterChange();
    }, PENDING_RECHECK_MS);
  }

  #clearRecheck() {
    if (this.#recheckTimer) clearTimeout(this.#recheckTimer);
    this.#recheckTimer = null;
  }
}
