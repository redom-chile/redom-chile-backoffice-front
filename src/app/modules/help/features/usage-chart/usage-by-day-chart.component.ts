import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartComponent } from 'ng-apexcharts';
import { ThemeService } from 'src/app/core/services/theme.service';
import { readChartTheme } from 'src/app/modules/dashboard/pages/admin/ui/charts';
import { formatInteger, formatUsd } from '../usage-format';

export type UsageDayPoint = Readonly<{ date: string; questions: number; costUsd: number }>;

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
const fullDayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Preguntas (barras) y costo en USD (línea, eje derecho) por día. */
@Component({
  selector: 'app-usage-by-day-chart',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-tile-soft h-full rounded-2xl p-4">
      <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-foreground font-semibold">Preguntas y costo por día</h2>
        <span class="text-muted-foreground text-xs">Barras: preguntas · Línea: costo (USD)</span>
      </div>
      @let options = $options();
      <apx-chart
        [series]="options.series"
        [chart]="options.chart"
        [colors]="options.colors"
        [stroke]="options.stroke"
        [plotOptions]="options.plotOptions"
        [markers]="options.markers"
        [dataLabels]="options.dataLabels"
        [legend]="options.legend"
        [xaxis]="options.xaxis"
        [yaxis]="options.yaxis"
        [grid]="options.grid"
        [tooltip]="options.tooltip" />
    </section>
  `,
})
export class UsageByDayChartComponent {
  readonly days = input.required<ReadonlyArray<UsageDayPoint>>();

  readonly #themeService = inject(ThemeService);

  readonly $options = computed(() => {
    const days = this.days();
    const theme = readChartTheme(this.#themeService.$resolvedMode());
    const axisLabels = { style: { colors: theme.muted, fontSize: '11px' } };
    return {
      series: [
        { name: 'Preguntas', type: 'column', data: days.map((day) => day.questions) },
        { name: 'Costo', type: 'line', data: days.map((day) => day.costUsd) },
      ],
      chart: {
        type: 'line' as const,
        height: 260,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        background: 'transparent',
      },
      colors: [theme.primary, theme.muted],
      stroke: { curve: 'smooth' as const, width: [0, 2] },
      plotOptions: { bar: { columnWidth: days.length > 45 ? '80%' : '55%', borderRadius: 3 } },
      markers: { size: [0, days.length <= 14 ? 3 : 0], hover: { size: 5 } },
      dataLabels: { enabled: false },
      legend: { show: false },
      xaxis: {
        categories: days.map((day) => dayLabel(day.date)),
        labels: { ...axisLabels, rotate: 0, hideOverlappingLabels: true },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: [
        {
          min: 0,
          forceNiceScale: true,
          labels: { ...axisLabels, formatter: (value: number) => formatInteger(Math.round(value)) },
        },
        {
          opposite: true,
          min: 0,
          forceNiceScale: true,
          labels: { ...axisLabels, formatter: (value: number) => formatUsd(value, value >= 1 ? 2 : 4) },
        },
      ],
      grid: { borderColor: theme.border, strokeDashArray: 4, xaxis: { lines: { show: false } } },
      tooltip: {
        theme: theme.mode,
        shared: true,
        intersect: false,
        x: { formatter: (_: number, opts?: { dataPointIndex: number }) => fullDayLabel(days[opts?.dataPointIndex ?? 0]?.date ?? '') },
        y: {
          formatter: (value: number, opts?: { seriesIndex: number }) =>
            opts?.seriesIndex === 1 ? formatUsd(value) : formatInteger(value),
        },
      },
    };
  });
}
