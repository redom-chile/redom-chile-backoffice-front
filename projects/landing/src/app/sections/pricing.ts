import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { Icon } from '../ui/icon';
import { APP_LINKS } from '../ui/links';

type Interval = 'month' | 'year';

type PlanPrice = Readonly<{ id: string; interval: Interval; amount: number; currency: string }>;
type PlanLimits = Readonly<{
  max_locations?: number | null;
  max_users?: number | null;
  max_registers?: number | null;
  ai_questions_month?: number | null;
}>;
type PublicPlan = Readonly<{
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isFree: boolean;
  isHighlighted: boolean;
  prices: PlanPrice[];
  features: { code: string; name: string }[];
  limits?: PlanLimits | null;
}>;

type PlansState = 'loading' | 'ready' | 'error';

const REQUEST_TIMEOUT_MS = 8000;

const LIMIT_LABELS: ReadonlyArray<{ key: keyof PlanLimits; label: string }> = [
  { key: 'max_locations', label: 'Locales' },
  { key: 'max_users', label: 'Usuarios' },
  { key: 'max_registers', label: 'Cajas' },
  { key: 'ai_questions_month', label: 'Preguntas al asistente IA al mes' },
];

/**
 * Planes y precios. Se cargan desde el endpoint público de billing SOLO en el navegador
 * (afterNextRender): el HTML prerenderizado trae el esqueleto de carga y no llama a la API en el build.
 */
@Component({
  selector: 'lnd-pricing',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section id="precios" class="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28" aria-labelledby="pricing-title">
      <div class="mx-auto max-w-2xl text-center">
        <p class="text-primary text-sm font-semibold uppercase tracking-wider">Precios</p>
        <h2 id="pricing-title" class="mt-2 text-3xl font-semibold sm:text-4xl">Un plan para cada etapa de tu restaurante</h2>
        <p class="text-muted-foreground mt-4">Empieza con 15 días del plan Pro y luego elige el plan que más te acomode. Puedes cambiarlo cuando quieras.</p>
      </div>

      @switch (state()) {
        @case ('loading') {
        <div class="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          <p class="sr-only" role="status">Cargando planes…</p>
          @for (i of skeletons; track i) {
          <div class="lnd-card animate-pulse rounded-2xl p-6" aria-hidden="true">
            <div class="bg-muted h-5 w-1/3 rounded-full"></div>
            <div class="bg-muted mt-3 h-3 w-4/5 rounded-full"></div>
            <div class="bg-muted mt-6 h-8 w-1/2 rounded-full"></div>
            <div class="mt-6 space-y-3">
              <div class="bg-muted h-3 w-full rounded-full"></div>
              <div class="bg-muted h-3 w-5/6 rounded-full"></div>
              <div class="bg-muted h-3 w-2/3 rounded-full"></div>
              <div class="bg-muted h-3 w-3/4 rounded-full"></div>
            </div>
            <div class="bg-muted mt-8 h-11 w-full rounded-full"></div>
          </div>
          }
        </div>
        }

        @case ('ready') {
        <div class="mt-10 flex justify-center">
          <div class="lnd-card inline-flex gap-1 rounded-full p-1" role="group" aria-label="Periodo de facturación">
            @for (option of intervals; track option.value) {
            <button
              type="button"
              class="rounded-full px-5 py-2 text-sm font-semibold transition-colors"
              [class]="interval() === option.value ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              [attr.aria-pressed]="interval() === option.value"
              (click)="interval.set(option.value)">
              {{ option.label }}
            </button>
            }
          </div>
        </div>

        <ul class="mt-10 grid gap-4" [class]="gridClass()">
          @for (plan of cards(); track plan.id) {
          <li class="lnd-card flex flex-col rounded-2xl p-6" [class.lnd-card--featured]="plan.highlighted">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-lg font-semibold">{{ plan.name }}</h3>
              @if (plan.highlighted) {
              <span class="bg-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">
                <lnd-icon name="sparkles" class="size-3.5" /> Recomendado
              </span>
              }
            </div>
            @if (plan.description) {
            <p class="text-muted-foreground mt-2 text-sm leading-relaxed">{{ plan.description }}</p>
            }

            <div class="mt-6 min-h-16">
              @if (plan.price) {
              <p class="flex flex-wrap items-baseline gap-x-1.5">
                <span class="text-3xl font-semibold tracking-tight">{{ plan.price }}</span>
                @if (plan.period) { <span class="text-muted-foreground text-sm">{{ plan.period }}</span> }
              </p>
              @if (plan.monthlyEquivalent) {
              <p class="text-muted-foreground mt-1 text-xs">equivale a {{ plan.monthlyEquivalent }}/mes</p>
              }
              } @else {
              <p class="text-xl font-semibold">Precio por confirmar</p>
              <p class="text-muted-foreground mt-1 text-xs">Pruébalo gratis mientras tanto.</p>
              }
            </div>

            @if (plan.limits.length) {
            <dl class="mt-6 space-y-2 border-t border-border/70 pt-5 text-sm">
              @for (limit of plan.limits; track limit.label) {
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">{{ limit.label }}</dt>
                <dd class="shrink-0 text-right font-semibold">{{ limit.value }}</dd>
              </div>
              }
            </dl>
            }

            @if (plan.features.length) {
            <ul class="mt-5 space-y-2.5 text-sm">
              @for (feature of plan.features; track feature.code) {
              <li class="flex items-start gap-2">
                <lnd-icon name="check" class="text-primary mt-0.5 size-4" />
                <span>{{ feature.name }}</span>
              </li>
              }
            </ul>
            }

            <a
              [href]="app.signUp"
              class="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition"
              [class]="plan.highlighted ? 'bg-primary text-white shadow-sm hover:brightness-110' : 'border border-border hover:border-primary hover:text-primary'">
              {{ plan.isFree ? 'Empezar gratis' : 'Probar gratis 15 días' }}
              <lnd-icon name="arrow" class="size-4" />
            </a>
          </li>
          }
        </ul>

        <p class="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-sm">
          Todos los planes pagados parten con 15 días de prueba del plan Pro. Precios en pesos chilenos, IVA incluido.
        </p>
        }

        @case ('error') {
        <div class="lnd-card mx-auto mt-14 max-w-2xl rounded-2xl p-8 text-center" role="status">
          <span class="bg-primary/10 text-primary mx-auto flex size-11 items-center justify-center rounded-xl p-2.5"><lnd-icon name="sparkles" class="size-6" /></span>
          <p class="mt-4 leading-relaxed">
            Pronto publicaremos nuestros planes. Mientras tanto, crea tu cuenta y prueba el plan Pro gratis por 15 días.
          </p>
          <a [href]="app.signUp" class="bg-primary mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Crear cuenta <lnd-icon name="arrow" class="size-4" />
          </a>
        </div>
        }
      }
    </section>
  `,
})
export class Pricing {
  protected readonly app = APP_LINKS;
  protected readonly skeletons = [1, 2, 3];
  protected readonly intervals: ReadonlyArray<{ value: Interval; label: string }> = [
    { value: 'month', label: 'Mensual' },
    { value: 'year', label: 'Anual' },
  ];

  protected readonly state = signal<PlansState>('loading');
  protected readonly interval = signal<Interval>('month');
  private readonly plans = signal<PublicPlan[]>([]);

  /** Columnas según la cantidad de planes (clases completas para que Tailwind las detecte). */
  protected readonly gridClass = computed(() => {
    const count = this.plans().length;
    if (count === 1) return 'mx-auto max-w-md';
    if (count === 2) return 'mx-auto max-w-4xl sm:grid-cols-2';
    if (count === 3) return 'sm:grid-cols-2 lg:grid-cols-3';
    return 'sm:grid-cols-2 lg:grid-cols-4';
  });

  protected readonly cards = computed(() => {
    const interval = this.interval();
    return this.plans().map((plan) => {
      const price = plan.prices?.find((p) => p.interval === interval);
      const currency = price?.currency || 'CLP';
      let priceLabel: string | null = null;
      let period: string | null = null;
      let monthlyEquivalent: string | null = null;
      if (price) {
        priceLabel = formatMoney(price.amount, currency);
        period = interval === 'year' ? '/año' : '/mes';
        if (interval === 'year' && price.amount > 0) monthlyEquivalent = formatMoney(Math.round(price.amount / 12), currency);
      } else if (plan.isFree) {
        priceLabel = formatMoney(0, currency);
        period = interval === 'year' ? '/año' : '/mes';
      }
      const limits = LIMIT_LABELS.filter(({ key }) => plan.limits && key in plan.limits).map(({ key, label }) => {
        const value = plan.limits?.[key];
        return { label, value: value == null ? 'Ilimitado' : new Intl.NumberFormat('es-CL').format(value) };
      });
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        isFree: plan.isFree,
        highlighted: plan.isHighlighted,
        price: priceLabel,
        period,
        monthlyEquivalent,
        limits,
        features: plan.features ?? [],
      };
    });
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Solo en el navegador: el prerender no ejecuta afterNextRender, así el build no llama a la API.
    afterNextRender(() => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      destroyRef.onDestroy(() => {
        clearTimeout(timeout);
        controller.abort();
      });
      fetch(`${environment.billingApiUrl}/plans/public`, { signal: controller.signal, headers: { Accept: 'application/json' } })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<unknown>;
        })
        .then((data) => {
          const plans = Array.isArray(data) ? (data as PublicPlan[]) : [];
          this.plans.set(plans);
          this.state.set(plans.length ? 'ready' : 'error');
        })
        .catch(() => this.state.set('error'))
        .finally(() => clearTimeout(timeout));
    });
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(amount)}`;
  }
}
