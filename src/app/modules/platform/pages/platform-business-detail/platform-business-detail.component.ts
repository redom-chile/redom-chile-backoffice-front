import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map, Observable, switchMap } from 'rxjs';
import { formatPlanUsage, PlanLimitCode } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  BILLING_METHOD_LABELS,
  BillingEventDto,
  formatClp,
  formatPlatformDate,
  getPlatformErrorMessage,
  INTERVAL_LABELS,
  InvoiceDto,
  OverrideDto,
  PaymentDto,
  PlatformBusinessDetailDto,
  PlatformService,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
} from '../../data-access';
import { formatDiscountValue, openBusinessDiscountModal } from '../../features/business-discount-modal';
import { openBusinessDateModal } from '../../features/business-date-modal';
import { openBusinessNotesModal } from '../../features/business-notes-modal';
import { openBusinessOverrideModal } from '../../features/business-override-modal';
import { openBusinessPlanModal } from '../../features/business-plan-modal';
import {
  BusinessModalData,
  EVENT_ACTOR_LABELS,
  EVENT_TYPE_LABELS,
  featureLabel,
  limitLabel,
  subscriptionKeyDate,
  summarizeEvent,
} from '../../features/business-shared';
import { openBusinessStatusModal } from '../../features/business-status-modal';
import { PaymentActionsService } from '../../features/payment-actions';
import { invoiceAmounts, invoiceLabel, isReversible, PaymentTarget } from '../../features/payment-shared';

const LIMITS: readonly PlanLimitCode[] = ['max_locations', 'max_users', 'max_registers', 'ai_questions_month'];
const EVENTS_PREVIEW = 10;

const INVOICE_STATUS: Record<InvoiceDto['status'], Readonly<{ label: string; tone: string }>> = {
  pending: { label: 'Pendiente', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  paid: { label: 'Pagado', tone: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  overdue: { label: 'Vencido', tone: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  void: { label: 'Anulado', tone: 'bg-[var(--muted)] text-muted-foreground' },
};
const INVOICE_KIND: Record<InvoiceDto['kind'], string> = { period: 'Período', proration: 'Prorrateo' };
const PAYMENT_STATUS: Record<PaymentDto['status'], Readonly<{ label: string; tone: string }>> = {
  pending: { label: 'Por confirmar', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  confirmed: { label: 'Confirmado', tone: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  rejected: { label: 'Rechazado', tone: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};
const PAYMENT_KIND: Record<PaymentDto['kind'], string> = { payment: 'Pago', refund: 'Reembolso', reversal: 'Reverso' };
const PAYMENT_METHOD: Record<PaymentDto['method'], string> = {
  flow_card: 'Tarjeta (Flow)',
  flow_other: 'Flow',
  transfer: 'Transferencia',
  cash: 'Efectivo',
  other: 'Otro',
};

type EventRow = Readonly<{ event: BillingEventDto; title: string; actor: string; lines: string[] }>;

/** Detalle de un negocio: suscripción, uso, cobros, pagos, excepciones e historial (la lectura queda auditada). */
@Component({
  selector: 'app-platform-business-detail',
  imports: [RouterLink, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-business-detail.component.html',
})
export class PlatformBusinessDetailComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #paymentActions = inject(PaymentActionsService);

  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly formatDiscount = formatDiscountValue;
  readonly featureLabel = featureLabel;
  readonly limitLabel = limitLabel;
  readonly keyDate = subscriptionKeyDate;
  readonly statusLabels = SUBSCRIPTION_STATUS_LABELS;
  readonly statusTones = SUBSCRIPTION_STATUS_TONES;
  readonly billingLabels = BILLING_METHOD_LABELS;
  readonly intervalLabels = INTERVAL_LABELS;
  readonly invoiceStatus = INVOICE_STATUS;
  readonly invoiceKind = INVOICE_KIND;
  readonly paymentStatus = PAYMENT_STATUS;
  readonly paymentKind = PAYMENT_KIND;
  readonly paymentMethod = PAYMENT_METHOD;
  readonly limits = LIMITS;

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);

  readonly detail = rxResource({
    params: () => (this.$isValidId() ? this.$id() : undefined),
    stream: ({ params }) => this.#platform.getBusiness(params).pipe(toRemoteResult()),
  });
  readonly $detail = computed(() => resultValue(this.detail.value()));
  readonly $error = computed(() => resultError(this.detail.value()));
  readonly $isNotFound = computed(() => !!this.$error() && readApiError(this.$error()).status === 404);
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'No se pudo cargar el negocio.'));

  // Nombres de los planes para el historial (planId → nombre).
  readonly #plans = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  readonly #planNames = computed(() => new Map((resultValue(this.#plans.value()) ?? []).map((plan) => [plan.id, plan.name])));

  // Primero las activas y después las terminadas.
  readonly $overrides = computed(() => [...(this.$detail()?.overrides ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive)));
  readonly $lockedCount = computed(() => {
    const locked = this.$detail()?.entitlements.lockedResources;
    return locked ? locked.locations.length + locked.registers.length + locked.users.length : 0;
  });

  // Historial: las consultas del detalle se repiten mucho, se ocultan por defecto.
  readonly $showReads = signal(false);
  readonly $showAllEvents = signal(false);
  readonly $events = computed<EventRow[]>(() => {
    const context = { planNames: this.#planNames() };
    return (this.$detail()?.events ?? [])
      .filter((event) => this.$showReads() || event.type !== 'billing_data_read')
      .map((event) => ({
        event,
        title: EVENT_TYPE_LABELS[event.type] ?? event.type,
        actor: event.actorName ?? EVENT_ACTOR_LABELS[event.actorRole] ?? event.actorRole,
        lines: summarizeEvent(event, context),
      }));
  });
  readonly $visibleEvents = computed(() => (this.$showAllEvents() ? this.$events() : this.$events().slice(0, EVENTS_PREVIEW)));
  readonly $readsCount = computed(() => (this.$detail()?.events ?? []).filter((event) => event.type === 'billing_data_read').length);

  usage(code: PlanLimitCode, detail: PlatformBusinessDetailDto): string {
    return formatPlanUsage(code, detail.entitlements.usage[code], detail.entitlements.limits[code]);
  }

  isOverLimit(code: PlanLimitCode, detail: PlatformBusinessDetailDto): boolean {
    const limit = detail.entitlements.limits[code];
    return limit !== null && detail.entitlements.usage[code] > limit;
  }

  usagePercent(code: PlanLimitCode, detail: PlatformBusinessDetailDto): number {
    const limit = detail.entitlements.limits[code];
    if (limit === null) return 0;
    if (limit === 0) return detail.entitlements.usage[code] > 0 ? 100 : 0;
    return Math.min(100, Math.round((detail.entitlements.usage[code] / limit) * 100));
  }

  overrideTitle(override: OverrideDto): string {
    const parts: string[] = [];
    if (override.featureCode) parts.push(featureLabel(override.featureCode));
    if (override.limitCode) parts.push(`${limitLabel(override.limitCode)}: ${override.limitValue === null ? 'ilimitado' : override.limitValue}`);
    return parts.join(' + ');
  }

  // --- Acciones ---

  changePlan(detail: PlatformBusinessDetailDto) {
    this.#afterSave(openBusinessPlanModal(this.#dialog, this.#modalData(detail)));
  }

  extendTrial(detail: PlatformBusinessDetailDto) {
    if (!detail.subscription) return;
    this.#afterSave(openBusinessDateModal(this.#dialog, { ...this.#modalData(detail), subscription: detail.subscription, mode: 'trial' }));
  }

  extendPeriod(detail: PlatformBusinessDetailDto) {
    if (!detail.subscription) return;
    this.#afterSave(openBusinessDateModal(this.#dialog, { ...this.#modalData(detail), subscription: detail.subscription, mode: 'period' }));
  }

  changeStatus(detail: PlatformBusinessDetailDto) {
    if (!detail.subscription) return;
    this.#afterSave(openBusinessStatusModal(this.#dialog, { ...this.#modalData(detail), subscription: detail.subscription }));
  }

  editNotes(detail: PlatformBusinessDetailDto) {
    if (!detail.subscription) return;
    this.#afterSave(openBusinessNotesModal(this.#dialog, { ...this.#modalData(detail), subscription: detail.subscription }));
  }

  assignDiscount(detail: PlatformBusinessDetailDto) {
    if (!detail.subscription) return;
    this.#afterSave(openBusinessDiscountModal(this.#dialog, { ...this.#modalData(detail), subscription: detail.subscription }));
  }

  removeDiscount(detail: PlatformBusinessDetailDto) {
    const discount = detail.subscription?.discount;
    if (!discount) return;
    this.#confirm({
      title: 'Quitar descuento',
      message: `${detail.business.name} dejará de tener el descuento ${discount.name} desde el próximo cobro.`,
      confirmText: 'Quitar',
      tone: 'danger',
    })
      .pipe(switchMap(() => this.#platform.removeDiscount(detail.business.id)))
      .subscribe({
        next: () => {
          this.#toast.show('Descuento quitado', 'success');
          this.detail.reload();
        },
        error: (error: unknown) => this.#toast.show(getPlatformErrorMessage(error, 'No se pudo quitar el descuento'), 'error'),
      });
  }

  addOverride(detail: PlatformBusinessDetailDto) {
    this.#afterSave(openBusinessOverrideModal(this.#dialog, { ...this.#modalData(detail), entitlements: detail.entitlements }));
  }

  endOverride(override: OverrideDto) {
    this.#confirm({
      title: 'Terminar excepción',
      message: `"${this.overrideTitle(override)}" termina ahora y queda en el historial. El negocio vuelve a lo que da su plan.`,
      confirmText: 'Terminar',
      tone: 'danger',
    })
      .pipe(switchMap(() => this.#platform.endOverride(override.id)))
      .subscribe({
        next: () => {
          this.#toast.show('Excepción terminada', 'success');
          this.detail.reload();
        },
        error: (error: unknown) => this.#toast.show(getPlatformErrorMessage(error, 'No se pudo terminar la excepción'), 'error'),
      });
  }

  // --- Cobros y pagos (fase 4) ---

  isPayable(invoice: InvoiceDto): boolean {
    return invoice.status === 'pending' || invoice.status === 'overdue';
  }

  isReversible(payment: PaymentDto, detail: PlatformBusinessDetailDto): boolean {
    return isReversible(payment, detail.payments);
  }

  registerPayment(detail: PlatformBusinessDetailDto, invoice: InvoiceDto) {
    // El detalle trae los últimos 20 pagos: lo pagado se calcula con ellos.
    const plan = this.#planNames().get(invoice.planId);
    const interval = detail.subscription?.price?.id === invoice.priceId ? detail.subscription.price.interval : null;
    this.#afterSave(
      this.#paymentActions.register({
        id: invoice.id,
        businessName: detail.business.name,
        label: invoiceLabel({ ...invoice, plan: plan ? { name: plan } : null, interval }),
        total: invoice.total,
        ...invoiceAmounts(invoice.id, detail.payments),
      }),
    );
  }

  confirmPayment(detail: PlatformBusinessDetailDto, payment: PaymentDto) {
    this.#afterSave(this.#paymentActions.confirm(this.#paymentTarget(detail, payment)));
  }

  rejectPayment(detail: PlatformBusinessDetailDto, payment: PaymentDto) {
    this.#afterSave(this.#paymentActions.reject(this.#paymentTarget(detail, payment)));
  }

  reversePayment(detail: PlatformBusinessDetailDto, payment: PaymentDto) {
    this.#afterSave(this.#paymentActions.reverse(this.#paymentTarget(detail, payment)));
  }

  #paymentTarget(detail: PlatformBusinessDetailDto, payment: PaymentDto): PaymentTarget {
    return { id: payment.id, amount: payment.amount, method: payment.method, reference: payment.reference, businessName: detail.business.name };
  }

  #modalData(detail: PlatformBusinessDetailDto): BusinessModalData {
    return { businessId: detail.business.id, businessName: detail.business.name, subscription: detail.subscription };
  }

  #afterSave(closed: Observable<boolean | undefined>) {
    closed.subscribe((saved) => {
      if (saved) this.detail.reload();
    });
  }

  /** Emite solo si confirma. */
  #confirm(data: ConfirmModalData): Observable<true> {
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, { width: '440px', maxWidth: '95vw', data })
      .afterClosed()
      .pipe(filter((confirmed): confirmed is true => confirmed === true));
  }
}
