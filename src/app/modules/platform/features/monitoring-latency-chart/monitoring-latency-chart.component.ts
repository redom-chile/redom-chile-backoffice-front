import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartComponent } from 'ng-apexcharts';
import { ThemeService } from 'src/app/core/services/theme.service';
import { readChartTheme } from 'src/app/modules/dashboard/pages/admin/ui/charts';
import { LatencyPointDto, MonitoredService } from '../../data-access';
import { MONITORED_SERVICES, SERVICE_LABELS } from '../../pages/platform-monitoring/platform-monitoring.labels';

// Un color fijo por servicio (no depende del tema, para reconocerlos en ambos modos).
const SERVICE_COLORS: Record<MonitoredService, string> = {
  auth: '#6366F1',
  restaurant: '#0EA5E9',
  billing: '#F59E0B',
};

const timeLabel = (value: number, withDay: boolean) =>
  new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    ...(withDay ? { day: 'numeric', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

/** Tiempo de respuesta promedio de /health por período y servicio (solo chequeos correctos). */
@Component({
  selector: 'app-monitoring-latency-chart',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let options = $options();
    <apx-chart
      [series]="options.series"
      [chart]="options.chart"
      [colors]="options.colors"
      [stroke]="options.stroke"
      [markers]="options.markers"
      [dataLabels]="options.dataLabels"
      [legend]="options.legend"
      [xaxis]="options.xaxis"
      [yaxis]="options.yaxis"
      [grid]="options.grid"
      [tooltip]="options.tooltip" />
  `,
})
export class MonitoringLatencyChartComponent {
  readonly points = input.required<ReadonlyArray<LatencyPointDto>>();
  // Rangos de más de un día muestran también la fecha.
  readonly withDay = input(false);

  readonly #themeService = inject(ThemeService);

  readonly $options = computed(() => {
    const points = this.points();
    const withDay = this.withDay();
    const theme = readChartTheme(this.#themeService.$resolvedMode());
    const axisLabels = { style: { colors: theme.muted, fontSize: '11px' } };
    return {
      series: MONITORED_SERVICES.map((service) => ({
        name: SERVICE_LABELS[service].name,
        data: points
          .filter((point) => point.service === service)
          .map((point) => ({ x: new Date(point.at).getTime(), y: point.avgMs })),
      })),
      chart: {
        type: 'line' as const,
        height: 260,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        background: 'transparent',
      },
      colors: MONITORED_SERVICES.map((service) => SERVICE_COLORS[service]),
      stroke: { curve: 'smooth' as const, width: 2 },
      markers: { size: 0, hover: { size: 4 } },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: 'top' as const,
        horizontalAlign: 'left' as const,
        labels: { colors: theme.muted },
      },
      xaxis: {
        type: 'datetime' as const,
        labels: { ...axisLabels, datetimeUTC: false, formatter: (value: string) => timeLabel(Number(value), withDay) },
        axisBorder: { show: false },
        axisTicks: { show: false },
        tooltip: { enabled: false },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: { ...axisLabels, formatter: (value: number) => `${Math.round(value)} ms` },
      },
      grid: { borderColor: theme.border, strokeDashArray: 4, xaxis: { lines: { show: false } } },
      tooltip: {
        theme: theme.mode,
        shared: true,
        intersect: false,
        x: { formatter: (value: number) => timeLabel(value, true) },
        y: {
          formatter: (value: number | null) =>
            value === null || value === undefined ? 'sin datos' : `${Math.round(value)} ms`,
        },
      },
    };
  });
}
