import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { formatDocumentDate, readDate, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { getHelpErrorMessage, HelpAdminService } from '../../data-access';
import { UsageByDayChartComponent } from '../../features/usage-chart';
import {
  addDaysIso,
  daysBetween,
  formatInteger,
  formatUsd,
  formatUsdTotal,
  HELP_USAGE_MAX_DAYS,
  todayInChile,
} from '../../features/usage-format';

type UsageQuery = Readonly<{ from: string | null; to: string | null }>;
type UsagePreset = 'thisMonth' | 'lastMonth' | 'last30';

function toQuery(params: ParamMap): UsageQuery {
  return { from: readDate(params, 'from'), to: readDate(params, 'to') };
}

/** Rango de cada atajo; "Este mes" es el valor por defecto del backend (sin parámetros). */
function presetRange(preset: UsagePreset, today: string): UsageQuery {
  if (preset === 'thisMonth') return { from: null, to: null };
  if (preset === 'last30') return { from: addDaysIso(today, -29), to: today };
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const lastOfPrevious = addDaysIso(firstOfMonth, -1);
  return { from: `${lastOfPrevious.slice(0, 7)}-01`, to: lastOfPrevious };
}

const PRESETS: ReadonlyArray<Readonly<{ value: UsagePreset; label: string }>> = [
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes pasado' },
  { value: 'last30', label: 'Últimos 30 días' },
];

/** Uso y costo del asistente con IA (SUPERADMIN). */
@Component({
  selector: 'app-admin-usage',
  imports: [RouterLink, HeaderDashboardComponent, IconComponent, SkeletonComponent, UsageByDayChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-usage.component.html',
})
export class AdminUsageComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #admin = inject(HelpAdminService);

  readonly presets = PRESETS;
  readonly maxDays = HELP_USAGE_MAX_DAYS;
  readonly formatDate = formatDocumentDate;
  readonly formatInteger = formatInteger;
  readonly formatUsd = formatUsd;
  readonly formatUsdTotal = formatUsdTotal;
  readonly skeletonCards = [1, 2, 3, 4, 5, 6];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });

  /** Misma validación que el backend (sin `to` es hoy; sin `from`, el día 1 del mes de `to`). */
  readonly $rangeError = computed(() => {
    const { from, to } = this.$query();
    const end = to ?? todayInChile();
    const start = from ?? `${end.slice(0, 7)}-01`;
    if (start > end) return 'La fecha "Desde" debe ser anterior o igual a "Hasta".';
    if (daysBetween(start, end) > HELP_USAGE_MAX_DAYS) return `El rango no puede superar los ${HELP_USAGE_MAX_DAYS} días.`;
    return null;
  });

  readonly $preset = computed<UsagePreset | null>(() => {
    const { from, to } = this.$query();
    const today = todayInChile();
    return PRESETS.find(({ value }) => {
      const range = presetRange(value, today);
      return range.from === from && range.to === to;
    })?.value ?? null;
  });

  readonly usage = rxResource({
    params: () => {
      if (this.$rangeError()) return undefined;
      const { from, to } = this.$query();
      return { from: from ?? undefined, to: to ?? undefined };
    },
    stream: ({ params }) => this.#admin.getUsage(params).pipe(toRemoteResult()),
  });
  readonly $usage = computed(() => resultValue(this.usage.value()));
  readonly $error = computed(() => resultError(this.usage.value()));
  readonly $errorMessage = computed(() => getHelpErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly $averageCost = computed(() => {
    const totals = this.$usage()?.totals;
    return totals && totals.questions > 0 ? totals.costUsd / totals.questions : null;
  });

  readonly $businesses = computed(() =>
    [...(this.$usage()?.byBusiness ?? [])].sort((a, b) => b.questions - a.questions || b.costUsd - a.costUsd),
  );

  handlePreset(preset: UsagePreset) {
    this.#navigate(presetRange(preset, todayInChile()));
  }

  handleDate(key: 'from' | 'to', event: Event) {
    this.#navigate({ [key]: (event.target as HTMLInputElement).value || null });
  }

  averageOf(costUsd: number, questions: number): string {
    return questions > 0 ? formatUsd(costUsd / questions) : '—';
  }

  #navigate(queryParams: Partial<Record<keyof UsageQuery, string | null>>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
