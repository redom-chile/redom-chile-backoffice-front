import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { formatPlatformDate, getPlatformErrorMessage, MonitoringRange, PlatformService } from '../../data-access';
import { MonitoringLatencyChartComponent } from '../../features/monitoring-latency-chart';
import {
  formatAgo,
  formatCount,
  formatDuration,
  formatMs,
  formatUptime,
  SERVICE_LABELS,
  STATUS_LABELS,
  uptimeTone,
} from './platform-monitoring.labels';

const RANGES: ReadonlyArray<Readonly<{ value: MonitoringRange; label: string }>> = [
  { value: '24h', label: '24 horas' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
];

// El sistema chequea cada minuto: la pantalla se actualiza sola con la misma frecuencia.
const REFRESH_MS = 60_000;

/** Salud de los servicios: estado, disponibilidad, tiempos de respuesta, caídas y errores (C42). */
@Component({
  selector: 'app-platform-monitoring',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    CheckPermissionDirective,
    MonitoringLatencyChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-monitoring.component.html',
})
export class PlatformMonitoringComponent {
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly RANGES = RANGES;
  protected readonly SERVICE_LABELS = SERVICE_LABELS;
  protected readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly formatUptime = formatUptime;
  protected readonly uptimeTone = uptimeTone;
  protected readonly formatMs = formatMs;
  protected readonly formatDuration = formatDuration;
  protected readonly formatCount = formatCount;
  protected readonly skeletonCards = [1, 2, 3];

  readonly $range = signal<MonitoringRange>('24h');
  readonly $checking = signal(false);
  // Reloj para los "hace X min" (se mueve con la recarga automática).
  readonly $now = signal(Date.now());

  readonly overview = rxResource({
    params: () => this.$range(),
    stream: ({ params }) => this.#platform.getMonitoring(params).pipe(toRemoteResult()),
  });
  readonly $overview = computed(() => resultValue(this.overview.value()));
  readonly $error = computed(() => resultError(this.overview.value()));
  readonly $errorMessage = computed(() => getPlatformErrorMessage(this.$error(), 'Intenta nuevamente.'));

  readonly $openIncidents = computed(() => (this.$overview()?.incidents ?? []).filter((incident) => !incident.endedAt));
  readonly $pastIncidents = computed(() => (this.$overview()?.incidents ?? []).filter((incident) => incident.endedAt));
  readonly $rangeLabel = computed(() => RANGES.find((range) => range.value === this.$range())?.label ?? '');
  readonly $downtimeSeconds = computed(() =>
    (this.$overview()?.incidents ?? []).reduce((total, incident) => total + incident.durationSeconds, 0),
  );

  constructor() {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => {
        this.$now.set(Date.now());
        if (!this.overview.isLoading()) this.overview.reload();
      });
  }

  ago(iso: string | null): string {
    return formatAgo(iso, this.$now());
  }

  date(iso: string | null): string {
    return formatPlatformDate(iso, true);
  }

  time(iso: string): string {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  setRange(range: MonitoringRange) {
    this.$range.set(range);
  }

  reload() {
    this.$now.set(Date.now());
    this.overview.reload();
  }

  handleCheckNow() {
    if (this.$checking()) return;
    this.$checking.set(true);
    this.#platform
      .runMonitoringCheck()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (run) => {
          this.$checking.set(false);
          const failed = run.probes.filter((probe) => !probe.ok);
          if (failed.length)
            this.#toast.show(
              `No responde: ${failed.map((probe) => SERVICE_LABELS[probe.service].name).join(', ')}`,
              'error',
            );
          else this.#toast.show('Los 3 servicios responden bien', 'success');
          this.reload();
        },
        error: (error: unknown) => {
          this.$checking.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo chequear los servicios.'), 'error');
        },
      });
  }
}
