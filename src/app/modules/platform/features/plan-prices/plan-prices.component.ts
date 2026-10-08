import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import {
  formatClp,
  formatPlatformDate,
  getPlatformErrorMessage,
  INTERVAL_LABELS,
  PlanInterval,
  PlatformPlanDto,
  PlatformPlanPriceDto,
  PlatformService,
} from '../../data-access';
import { confirmPlanAction, PLAN_INTERVAL_SUFFIX, subscriptionsLabel } from '../plan-shared';

const INTERVALS: PlanInterval[] = ['month', 'year'];

type HistoryRow = PlatformPlanPriceDto & { until: string | null };

/** Pestaña "Precios": el vigente por intervalo, el historial y "Nuevo precio". */
@Component({
  selector: 'app-plan-prices',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($plan().isFree) {
    <div class="glass flex flex-col items-center gap-2 rounded-[1rem] px-4 py-12 text-center">
      <app-icon class="text-muted-foreground h-10 w-10">money_off</app-icon>
      <p class="text-foreground font-medium">Los planes free no tienen precios</p>
      <p class="text-muted-foreground text-sm">Para cobrar este plan, desmarca "Free" en la pestaña Datos.</p>
    </div>
    } @else {
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        @for (group of $groups(); track group.interval) {
        <section class="glass rounded-[1rem] p-4">
          <h3 class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{{ intervalLabels[group.interval] }}</h3>
          @if (group.active; as price) {
          <p class="text-foreground mt-1 text-2xl font-semibold tabular-nums">
            {{ formatClp(price.amount) }}<span class="text-muted-foreground text-sm font-normal">{{ suffix[price.interval] }}</span>
          </p>
          @if (price.interval === 'year') {
          <p class="text-muted-foreground text-xs">
            Equivale a {{ formatClp(monthly(price.amount)) }}/mes
            @if ($yearlySaving(); as saving) {
            · {{ saving }} % menos que el mensual
            }
          </p>
          }
          <p class="text-muted-foreground mt-2 text-xs">Vigente desde el {{ formatDate(price.createdAt) }} · {{ subscriptionsLabel(price.subscriptions) }}</p>
          } @else {
          <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">Sin precio vigente</p>
          <p class="text-muted-foreground mt-1 text-xs">Sin precio {{ intervalLabels[group.interval].toLowerCase() }}, el plan no se puede contratar con ese intervalo.</p>
          }
        </section>
        }
      </div>

      <form class="glass rounded-[1rem] p-4" [formGroup]="form" (ngSubmit)="handleSubmit()">
        <h3 class="text-foreground font-semibold">Nuevo precio</h3>
        <p class="text-muted-foreground mb-3 text-xs">En CLP con IVA incluido. Reemplaza al vigente del intervalo, que queda en el historial.</p>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div class="inline-flex shrink-0 rounded-lg p-1" role="radiogroup" aria-label="Intervalo">
            @for (interval of intervals; track interval) {
            <button
              type="button"
              role="radio"
              class="rounded-md px-3 py-1.5 text-sm font-medium"
              [class]="$interval() === interval ? 'bg-primary text-white' : 'glass-row'"
              [class.ml-1]="!$first"
              [attr.aria-checked]="$interval() === interval"
              (click)="form.controls.interval.setValue(interval)">
              {{ intervalLabels[interval] }}
            </button>
            }
          </div>
          <div class="min-w-0 flex-1 sm:max-w-xs">
            <label for="plan-price-amount" class="sr-only">Monto</label>
            <div class="relative">
              <span class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">$</span>
              <input
                id="plan-price-amount"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                formControlName="amount"
                placeholder="29990"
                class="glass-input w-full rounded-md py-2 pr-3 pl-7 tabular-nums"
                [class.border-red-500]="form.controls.amount.invalid && form.controls.amount.touched" />
            </div>
            @if (form.controls.amount.invalid && form.controls.amount.touched) {
            <p class="text-destructive mt-1 text-xs">Ingresa un monto entero mayor que 0.</p>
            } @else if ($amount(); as amount) {
            <p class="text-muted-foreground mt-1 text-xs">
              {{ formatClp(amount) }}{{ suffix[$interval()] }}
              @if ($interval() === 'year') {
              · equivale a {{ formatClp(monthly(amount)) }}/mes
              }
            </p>
            }
          </div>
          <app-button type="submit" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()">Crear precio</app-button>
        </div>
      </form>

      <section class="glass overflow-hidden rounded-[1rem]">
        <h3 class="text-foreground border-b border-[var(--border)] px-4 py-3 font-semibold">Historial</h3>
        @if ($history().length) {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[520px] text-sm">
            <thead class="text-muted-foreground text-left text-xs">
              <tr>
                <th class="px-4 py-2 font-medium">Intervalo</th>
                <th class="px-4 py-2 text-right font-medium">Monto</th>
                <th class="px-4 py-2 font-medium">Vigencia</th>
                <th class="px-4 py-2 text-right font-medium">Suscripciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border)]">
              @for (price of $history(); track price.id) {
              <tr class="glass-row">
                <td class="px-4 py-2">{{ intervalLabels[price.interval] }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ formatClp(price.amount) }}</td>
                <td class="text-muted-foreground px-4 py-2">{{ formatDate(price.createdAt) }} – {{ price.until ? formatDate(price.until) : '—' }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ price.subscriptions }}</td>
              </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-muted-foreground px-4 py-2 text-xs">Las suscripciones de un precio anterior lo mantienen hasta que cambien de plan o precio.</p>
        } @else {
        <p class="text-muted-foreground px-4 py-6 text-center text-sm">Todavía no hay precios anteriores.</p>
        }
      </section>
    </div>
    }
  `,
})
export class PlanPricesComponent {
  readonly $plan = input.required<PlatformPlanDto>({ alias: 'plan' });
  readonly saved = output<PlatformPlanDto>();

  readonly #fb = inject(FormBuilder);
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly intervals = INTERVALS;
  readonly intervalLabels = INTERVAL_LABELS;
  readonly suffix = PLAN_INTERVAL_SUFFIX;
  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly subscriptionsLabel = subscriptionsLabel;

  readonly form = this.#fb.group({
    interval: this.#fb.nonNullable.control<PlanInterval>('month'),
    amount: this.#fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]),
  });
  readonly $interval = toSignal(this.form.controls.interval.valueChanges, { initialValue: this.form.controls.interval.value });
  readonly $amount = toSignal(this.form.controls.amount.valueChanges, { initialValue: null });
  readonly $isSaving = signal(false);

  readonly $groups = computed(() => {
    const prices = this.$plan().prices;
    return INTERVALS.map((interval) => ({ interval, active: prices.find((price) => price.interval === interval && price.isActive) ?? null }));
  });

  /** Precios inactivos, del más nuevo al más antiguo; "hasta" = cuándo se creó el siguiente del mismo intervalo. */
  readonly $history = computed<HistoryRow[]>(() => {
    const sorted = [...this.$plan().prices].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return sorted
      .map((price, index) => ({
        ...price,
        until: sorted.slice(0, index).reverse().find((newer) => newer.interval === price.interval)?.createdAt ?? null,
      }))
      .filter((price) => !price.isActive);
  });

  readonly $yearlySaving = computed(() => {
    const [month, year] = this.$groups().map((group) => group.active?.amount ?? null);
    if (!month || !year) return null;
    const saving = Math.round((1 - year / (month * 12)) * 100);
    return saving > 0 ? saving : null;
  });

  monthly(amount: number): number {
    return Math.round(amount / 12);
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    const { interval, amount } = this.form.getRawValue();
    if (this.form.invalid || amount === null) {
      this.form.markAllAsTouched();
      this.#toast.show('Ingresa un monto entero mayor que 0', 'warning');
      return;
    }
    const plan = this.$plan();
    const current = this.$groups().find((group) => group.interval === interval)?.active ?? null;
    const label = INTERVAL_LABELS[interval].toLowerCase();
    const replaces = current
      ? ` Reemplaza al precio ${label} de ${formatClp(current.amount)} (${subscriptionsLabel(current.subscriptions)}).`
      : '';
    confirmPlanAction(this.#dialog, {
      title: `Nuevo precio ${label}`,
      message: `${formatClp(amount)}${PLAN_INTERVAL_SUFFIX[interval]} para "${plan.name}".${replaces} Las suscripciones actuales mantienen su precio; el nuevo aplica a las nuevas.`,
      confirmText: 'Crear precio',
      cancelText: 'Volver',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$isSaving.set(true);
      this.#platform
        .createPlanPrice(plan.id, { interval, amount: Number(amount) })
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: (updated) => {
            this.$isSaving.set(false);
            this.form.controls.amount.reset(null);
            this.#toast.show('Precio creado', 'success');
            this.saved.emit(updated);
          },
          error: (error: unknown) => {
            this.$isSaving.set(false);
            this.#toast.show(getPlatformErrorMessage(error, 'No se pudo crear el precio'), 'error');
          },
        });
    });
  }
}
