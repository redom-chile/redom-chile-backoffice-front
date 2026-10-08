import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import {
  EntitlementsService,
  formatPlanUsage,
  PLAN_FEATURE_LABELS,
  PLAN_FEATURES,
  PlanLimitCode,
  PublicPlanDto,
  PublicPlansService,
  SubscriptionStatus,
} from 'src/app/core/services/entitlements';
import { EmptyStateComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';

type Interval = 'month' | 'year';

const LIMITS: ReadonlyArray<Readonly<{ code: PlanLimitCode; label: string }>> = [
  { code: 'max_locations', label: 'Locales' },
  { code: 'max_users', label: 'Usuarios' },
  { code: 'max_registers', label: 'Cajas' },
  { code: 'ai_questions_month', label: 'Preguntas IA al mes' },
];

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago atrasado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

type PlanCard = Readonly<{
  plan: PublicPlanDto;
  current: boolean;
  /** "$29.990 / mes"; null = sin precio para el intervalo elegido. */
  price: string | null;
  /** Solo anual: "Equivale a $24.992 / mes". */
  monthlyEquivalent: string | null;
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

/** Comparación de planes. El pago en línea llega en la próxima fase: por ahora solo se informa. */
@Component({
  selector: 'app-plans',
  imports: [HeaderDashboardComponent, IconComponent, SkeletonComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans.component.html',
})
export class PlansComponent {
  readonly #plans = inject(PublicPlansService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #settings = inject(BusinessSettingsService);

  // undefined: cargando; [] también cuando la API falla (el servicio no lanza el error).
  readonly #list = toSignal(this.#plans.plans$, { initialValue: undefined });

  readonly $interval = signal<Interval>('month');
  readonly $isLoading = computed(() => this.#list() === undefined);
  readonly $isEmpty = computed(() => this.#list()?.length === 0);
  readonly $isOwner = this.#entitlements.$isOwner;

  /** Plan actual del negocio (no aplica a SUPERADMIN ni si todavía no llegan los entitlements). */
  readonly $current = computed(() => {
    const value = this.#entitlements.$entitlements();
    if (!value || this.#entitlements.$isSuperAdmin()) return null;
    let status = value.status ? STATUS_LABELS[value.status] : null;
    if (value.status === 'trialing' && value.trialEndsAt) {
      const date = this.#formatDate(value.trialEndsAt);
      if (date) status = `En prueba hasta el ${date}`;
    }
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
    const currentCode = this.$current()?.code ?? null;
    return (this.#list() ?? []).map((plan) => {
      const price = plan.prices.find((item) => item.interval === interval);
      const included = new Set<string>(plan.features.map((feature) => feature.code));
      return {
        plan,
        current: plan.code === currentCode,
        price: price ? `${formatMoney(price.amount, price.currency)} / ${interval === 'month' ? 'mes' : 'año'}` : null,
        monthlyEquivalent:
          price && interval === 'year' ? `Equivale a ${formatMoney(Math.round(price.amount / 12), price.currency)} / mes` : null,
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
    location.reload();
  }

  #formatDate(value: string): string | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const timeZone = this.#settings.$settings()?.timeZone || 'America/Santiago';
    try {
      return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone });
    } catch {
      return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
    }
  }
}
