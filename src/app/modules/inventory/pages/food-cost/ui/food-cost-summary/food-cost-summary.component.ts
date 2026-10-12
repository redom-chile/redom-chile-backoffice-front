import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { FOOD_COST_LEVEL_CLASSES, foodCostLevel, formatMoney, formatQuantity } from '../../../../data-access';
import { FoodCostSummary } from '../../data-access';

/** Tarjetas de resumen del food cost. */
@Component({
  selector: 'app-food-cost-summary',
  imports: [IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let s = summary();
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="glass rounded-[1rem] p-4">
        <p class="text-muted-foreground text-xs font-medium">Analizados</p>
        @if (loading() || !s) {
        <app-skeleton size="sm" class="mt-2 block" style="width: 60px" />
        } @else {
        <p class="text-foreground mt-1 text-2xl font-semibold tabular-nums">{{ s.analyzed }}</p>
        <p class="text-muted-foreground text-xs">platos y productos</p>
        }
      </div>

      <div class="glass rounded-[1rem] p-4">
        <p class="text-muted-foreground text-xs font-medium">Food cost promedio</p>
        @if (loading() || !s) {
        <app-skeleton size="sm" class="mt-2 block" style="width: 80px" />
        } @else if (s.averagePercent === null) {
        <p class="text-muted-foreground mt-1 text-2xl font-semibold">—</p>
        } @else {
        <p class="mt-1">
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xl font-semibold tabular-nums" [class]="$levelClass()">
            {{ formatQuantity(round(s.averagePercent)) }} %
          </span>
        </p>
        <p class="text-muted-foreground text-xs">Ponderado por precio</p>
        }
      </div>

      <div class="glass rounded-[1rem] p-4">
        <p class="text-muted-foreground text-xs font-medium">Margen promedio</p>
        @if (loading() || !s) {
        <app-skeleton size="sm" class="mt-2 block" style="width: 80px" />
        } @else {
        <p class="mt-1 text-2xl font-semibold tabular-nums" [class]="(s.averageMargin ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'">
          {{ s.averageMargin === null ? '—' : formatMoney(s.averageMargin) }}
        </p>
        <p class="text-muted-foreground text-xs">Por unidad, sin IVA</p>
        }
      </div>

      <button
        type="button"
        class="glass rounded-[1rem] p-4 text-left transition"
        [class.ring-2]="warningsActive()"
        [class.ring-amber-500]="warningsActive()"
        [disabled]="loading() || !s || (!s.withWarnings && !warningsActive())"
        [attr.aria-pressed]="warningsActive()"
        [title]="warningsActive() ? 'Mostrar todos' : 'Ver solo los que tienen avisos'"
        (click)="toggleWarnings.emit()">
        <p class="text-muted-foreground flex items-center gap-1 text-xs font-medium">
          <app-icon class="h-4 w-4" aria-hidden="true">warning</app-icon>Con avisos
        </p>
        @if (loading() || !s) {
        <app-skeleton size="sm" class="mt-2 block" style="width: 60px" />
        } @else {
        <p class="mt-1 text-2xl font-semibold tabular-nums" [class]="s.withWarnings ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'">
          {{ s.withWarnings }}
        </p>
        <p class="text-muted-foreground text-xs">Sin receta o costo incompleto</p>
        }
      </button>
    </div>
  `,
})
export class FoodCostSummaryComponent {
  readonly summary = input<FoodCostSummary | null>(null);
  readonly loading = input(false);
  readonly warningsActive = input(false);
  readonly toggleWarnings = output<void>();

  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly $levelClass = computed(() => FOOD_COST_LEVEL_CLASSES[foodCostLevel(this.summary()?.averagePercent)]);

  protected round(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
