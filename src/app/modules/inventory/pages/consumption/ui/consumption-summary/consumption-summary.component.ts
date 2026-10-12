import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { ConsumptionReportDto, formatMoney } from '../../../../data-access';

/** Tarjetas con los totales valorizados del período. */
@Component({
  selector: 'app-consumption-summary',
  imports: [IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = totals();
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="glass-tile-soft flex flex-col gap-1 rounded-2xl p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-muted-foreground text-sm">Consumo teórico</p>
          <app-icon class="text-primary hidden h-5 w-5 sm:block" aria-hidden="true">receipt_long</app-icon>
        </div>
        @if (loading()) {
        <app-skeleton size="xs" style="width: 80px" />
        } @else {
        <p class="text-foreground text-xl font-bold tabular-nums sm:text-2xl">{{ formatMoney(t?.theoreticalValue) }}</p>
        }
        <p class="text-muted-foreground text-xs">Lo que las ventas debieron consumir</p>
      </div>

      <div class="glass-tile-soft flex flex-col gap-1 rounded-2xl p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-muted-foreground text-sm">Mermas</p>
          <app-icon class="hidden h-5 w-5 text-amber-600 sm:block dark:text-amber-400" aria-hidden="true">delete_sweep</app-icon>
        </div>
        @if (loading()) {
        <app-skeleton size="xs" style="width: 80px" />
        } @else {
        <p class="text-xl font-bold tabular-nums sm:text-2xl" [class]="t?.wasteValue ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'">
          {{ formatMoney(t?.wasteValue) }}
        </p>
        }
        <p class="text-muted-foreground text-xs">Pérdidas registradas como ajuste</p>
      </div>

      <div class="glass-tile-soft flex flex-col gap-1 rounded-2xl p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-muted-foreground text-sm">Faltantes del conteo</p>
          <app-icon class="text-primary hidden h-5 w-5 sm:block" aria-hidden="true">fact_check</app-icon>
        </div>
        @if (loading()) {
        <app-skeleton size="xs" style="width: 80px" />
        } @else {
        @let diff = t?.countDifferenceValue ?? 0;
        <p class="text-xl font-bold tabular-nums sm:text-2xl" [class]="diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-foreground'">
          {{ formatMoney(diff) }}
        </p>
        <p class="text-muted-foreground text-xs">{{ diff < 0 ? 'Faltó stock al contar' : diff > 0 ? 'Sobró stock al contar' : 'Sin diferencias de conteo' }}</p>
        }
      </div>

      <div class="flex flex-col gap-1 rounded-2xl border-2 p-4" [class]="$varianceClass()">
        <div class="flex items-center justify-between gap-2">
          <p class="text-foreground text-sm font-semibold">Variación</p>
          <app-icon class="hidden h-5 w-5 sm:block" aria-hidden="true">trending_up</app-icon>
        </div>
        @if (loading()) {
        <app-skeleton size="xs" style="width: 80px" />
        } @else {
        <p class="text-xl font-bold tabular-nums sm:text-2xl">{{ formatMoney(t?.varianceValue) }}</p>
        }
        <p class="text-muted-foreground text-xs">Real − teórico: lo que se perdió</p>
      </div>
    </div>
  `,
})
export class ConsumptionSummaryComponent {
  readonly totals = input.required<ConsumptionReportDto['totals'] | null>();
  readonly loading = input(false);

  readonly formatMoney = formatMoney;

  // Variación > 0 = pérdida (rojo); < 0 = sobró más de lo esperado.
  readonly $varianceClass = computed(() => {
    const value = this.totals()?.varianceValue ?? 0;
    if (value > 0) return 'border-red-500/40 bg-red-500/10 text-red-600';
    if (value < 0) return 'border-green-500/40 bg-green-500/10 text-green-600';
    return 'border-primary/30 bg-primary/5 text-foreground';
  });
}
