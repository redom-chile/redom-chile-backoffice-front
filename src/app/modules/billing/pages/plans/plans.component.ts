import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, linkedSignal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import {
  EntitlementsService,
  formatPlanUsage,
  PLAN_FEATURE_LABELS,
  PLAN_FEATURES,
  PlanLimitCode,
  PublicPlansService,
} from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { BillingService, CheckoutResultDto, formatClp, INTERVAL_LABELS, PlanInterval } from '../../data-access';
import {
  CheckoutPreview,
  formatBillingDate,
  injectBillingTimeZone,
  previewCheckout,
  SUBSCRIPTION_STATUS_LABELS,
} from '../../features/billing-format';
import { openCheckoutModal } from '../../features/checkout-modal';

type Interval = PlanInterval;

const LIMITS: ReadonlyArray<Readonly<{ code: PlanLimitCode; label: string }>> = [
  { code: 'max_locations', label: 'Locales' },
  { code: 'max_users', label: 'Usuarios' },
  { code: 'max_registers', label: 'Cajas' },
  { code: 'ai_questions_month', label: 'Preguntas IA al mes' },
];

const ACTION_BUTTONS: Record<CheckoutPreview, string> = {
  purchase: 'Elegir',
  renewal: 'Pagar próximo período',
  upgrade: 'Mejorar',
  scheduled: 'Cambiar',
};

type CardPrice = Readonly<{ id: number; interval: Interval; amount: number; currency: string; isCurrent: boolean }>;

/** Plan normalizado: el dueño ve GET {BILLING}/plans (con isCurrent y su plan a medida); el resto, los públicos. */
type ComparablePlan = Readonly<{
  id: number;
  code: string;
  name: string;
  description: string | null;
  isFree: boolean;
  isHighlighted: boolean;
  isCurrent: boolean;
  prices: readonly CardPrice[];
  features: ReadonlyArray<{ code: string; name: string }>;
  limits: Readonly<Partial<Record<PlanLimitCode, number | null>>>;
}>;

type PlanCard = Readonly<{
  plan: ComparablePlan;
  current: boolean;
  /** Precio del intervalo elegido; null = sin precio para ese intervalo. */
  price: CardPrice | null;
  /** "$29.990 / mes". */
  priceLabel: string | null;
  /** Solo anual: "Equivale a $24.992 / mes". */
  monthlyEquivalent: string | null;
  /** Plan pagado sin precios: todavía no está a la venta. */
  comingSoon: boolean;
  /** Solo el dueño: lo que hará el checkout con este precio. */
  action: CheckoutPreview | null;
  limits: ReadonlyArray<Readonly<{ label: string; value: string }>>;
  features: ReadonlyArray<Readonly<{ code: string; label: string; included: boolean }>>;
}>;

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: currency === 'CLP' ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString('es-CL')}`;
  }
}

/** Comparación de planes. El dueño elige un plan (checkout con transferencia); el resto del equipo solo los ve. */
@Component({
  selector: 'app-plans',
  imports: [RouterLink, HeaderDashboardComponent, IconComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans.component.html',
})
export class PlansComponent {
  readonly #plans = inject(PublicPlansService);
  readonly #billing = inject(BillingService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);

  readonly $timeZone = injectBillingTimeZone();
  readonly $isOwner = computed(() => this.#entitlements.$isOwner() && !this.#entitlements.$isSuperAdmin());
  readonly buttonLabels = ACTION_BUTTONS;

  // Resto del equipo: undefined cargando; [] también cuando la API falla (el servicio no lanza el error).
  readonly #publicList = toSignal(this.#plans.plans$, { initialValue: undefined });

  // Dueño: planes con isCurrent y la suscripción para anticipar qué hará el checkout.
  readonly #ownerPlans = rxResource({
    params: () => (this.$isOwner() ? true : undefined),
    stream: () => this.#billing.getPlans().pipe(toRemoteResult()),
  });
  readonly #subscription = rxResource({
    params: () => (this.$isOwner() ? true : undefined),
    stream: () => this.#billing.getSubscription().pipe(toRemoteResult()),
  });
  readonly #currentSubscription = computed(() => resultValue(this.#subscription.value()));

  readonly $interval = linkedSignal<Interval>(() => this.#currentSubscription()?.price?.interval ?? 'month');

  readonly #list = computed<ComparablePlan[] | undefined>(() => {
    if (this.$isOwner()) {
      const result = this.#ownerPlans.value();
      if (!result) return undefined;
      return resultValue(result) ?? [];
    }
    const list = this.#publicList();
    if (!list) return undefined;
    const currentCode = this.#entitlements.$isSuperAdmin() ? null : (this.#entitlements.$entitlements()?.plan.code ?? null);
    return list.map((plan) => ({
      ...plan,
      description: plan.description ?? null,
      isCurrent: plan.code === currentCode,
      prices: plan.prices.map((price) => ({ ...price, isCurrent: false })),
    }));
  });

  readonly $isLoading = computed(() => this.#list() === undefined);
  readonly $isEmpty = computed(() => this.#list()?.length === 0 || !!resultError(this.#ownerPlans.value()));

  /** Plan actual del negocio (no aplica a SUPERADMIN ni si todavía no llegan los entitlements). */
  readonly $current = computed(() => {
    const value = this.#entitlements.$entitlements();
    if (!value || this.#entitlements.$isSuperAdmin()) return null;
    let status = value.status ? SUBSCRIPTION_STATUS_LABELS[value.status] : null;
    if (value.status === 'trialing' && value.trialEndsAt) status = `En prueba hasta el ${this.#formatDate(value.trialEndsAt)}`;
    return { code: value.plan.code, name: value.plan.name, status, warning: value.status === 'past_due' };
  });

  /** Uso de cada límite del plan (solo para el dueño). */
  readonly $usage = computed(() => {
    if (!this.$current() || !this.$isOwner()) return [];
    return LIMITS.map(({ code, label }) => {
      const used = this.#entitlements.usageOf(code);
      const limit = this.#entitlements.limitOf(code);
      const percent = limit === null ? null : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
      return { code, label, text: formatPlanUsage(code, used, limit), percent, full: limit !== null && used >= limit };
    });
  });

  readonly $cards = computed<PlanCard[]>(() => {
    const interval = this.$interval();
    const owner = this.$isOwner();
    const subscription = this.#currentSubscription();
    return (this.#list() ?? []).map((plan) => {
      const price = plan.prices.find((item) => item.interval === interval) ?? null;
      const included = new Set<string>(plan.features.map((feature) => feature.code));
      return {
        plan,
        current: plan.isCurrent,
        price,
        priceLabel: price ? `${formatMoney(price.amount, price.currency)} / ${interval === 'month' ? 'mes' : 'año'}` : null,
        monthlyEquivalent:
          price && interval === 'year' ? `Equivale a ${formatMoney(Math.round(price.amount / 12), price.currency)} / mes` : null,
        comingSoon: !plan.isFree && plan.prices.length === 0,
        action: owner && price && !plan.isFree ? previewCheckout(subscription, price) : null,
        limits: LIMITS.map(({ code, label }) => {
          const value = plan.limits[code];
          return { label, value: value === null || value === undefined ? 'Ilimitado' : value.toLocaleString('es-CL') };
        }),
        features: PLAN_FEATURES.map((code) => ({
          code,
          label: plan.features.find((feature) => feature.code === code)?.name ?? PLAN_FEATURE_LABELS[code],
          included: included.has(code),
        })),
      };
    });
  });

  setInterval(interval: Interval) {
    this.$interval.set(interval);
  }

  reload() {
    if (this.$isOwner()) {
      this.#ownerPlans.reload();
      this.#subscription.reload();
    } else {
      location.reload();
    }
  }

  otherIntervalLabel(): string {
    return INTERVAL_LABELS[this.$interval() === 'month' ? 'year' : 'month'].toLowerCase();
  }

  handleChoose(card: PlanCard) {
    if (!card.price || !this.$isOwner()) return;
    openCheckoutModal(this.#dialog, {
      plan: { id: card.plan.id, name: card.plan.name },
      price: card.price,
      subscription: this.#currentSubscription(),
      timeZone: this.$timeZone(),
    })
      .pipe(filter(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe((result) => this.#afterCheckout(result));
  }

  #afterCheckout(result: CheckoutResultDto) {
    this.#entitlements.refresh();
    if (result.action === 'scheduled' || !result.invoice) {
      const change = result.scheduledChange;
      this.#toast.show(
        change ? `Tu plan cambiará a ${change.plan.name} el ${this.#formatDate(change.at)}` : 'Listo: actualizamos tu plan',
        'success',
      );
      this.#ownerPlans.reload();
      this.#subscription.reload();
      return;
    }
    const total = formatClp(result.invoice.total);
    const message =
      result.action === 'upgrade'
        ? `Ya tienes el plan ${result.invoice.plan.name}. Transfiere la diferencia de ${total} en los próximos 3 días.`
        : `Generamos tu cobro de ${total}. Transfiere y avísanos con "Ya transferí".`;
    this.#toast.show(message, 'success');
    this.#router.navigateByUrl('/billing/subscription');
  }

  #formatDate(value: string): string {
    return formatBillingDate(value, this.$timeZone());
  }
}
