import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { InventoryService } from '../../../../data-access';
import { resultValue, toRemoteResult } from '../../../../shared';

/**
 * Alerta de productos bajo el mínimo en un local. "pill" para el encabezado del inventario y
 * "card" para el dashboard. Al hacer clic emite `activate` (activar el filtro "Solo bajo mínimo").
 * Si falla la carga no se muestra: es solo un aviso.
 */
@Component({
  selector: 'app-low-stock-alert',
  imports: [IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'card') {
    @if ($count() !== null || count.isLoading()) {
    <button
      type="button"
      class="glass-tile-soft flex h-full w-full flex-col gap-2 rounded-2xl p-4 text-left transition hover:opacity-90"
      [disabled]="!$count()"
      (click)="activate.emit()">
      <div class="flex items-center justify-between gap-2">
        <p class="text-muted-foreground text-sm">Stock bajo mínimo</p>
        <span class="flex h-9 w-9 items-center justify-center rounded-lg" [class]="$count() ? 'bg-red-500/15 text-red-600' : 'bg-primary/10 text-primary'">
          <app-icon class="h-5 w-5">{{ $count() ? 'warning' : 'inventory_2' }}</app-icon>
        </span>
      </div>
      @if (count.isLoading()) {
      <app-skeleton size="xs" style="width: 60px" />
      } @else {
      <p class="text-2xl font-bold tabular-nums" [class]="$count() ? 'text-red-600' : 'text-foreground'">{{ $count() }}</p>
      }
      <p class="text-muted-foreground text-xs">{{ hint() }}</p>
      @if ($count()) {
      <span class="text-primary mt-auto text-xs font-medium">Ver productos</span>
      }
    </button>
    }
    } @else {
    @if (count.isLoading()) {
    <app-skeleton size="xs" style="width: 120px" />
    } @else if ($count() === 0) {
    <span class="text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm">
      <app-icon class="h-4 w-4 text-green-600">check_circle</app-icon>
      Sin alertas de stock
    </span>
    } @else if ($count(); as total) {
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/25"
      [class.ring-2]="active()"
      [class.ring-red-500]="active()"
      [attr.aria-pressed]="active()"
      [title]="active() ? 'Mostrando solo los productos bajo el mínimo' : 'Ver solo los productos bajo el mínimo'"
      (click)="activate.emit()">
      <app-icon class="h-4 w-4">warning</app-icon>
      {{ total }} {{ total === 1 ? 'producto bajo mínimo' : 'productos bajo mínimo' }}
    </button>
    }
    }
  `,
})
export class LowStockAlertComponent {
  readonly #inventory = inject(InventoryService);

  readonly locationId = input.required<number | null>();
  readonly variant = input<'pill' | 'card'>('pill');
  readonly active = input(false);
  readonly hint = input('En el local elegido');
  readonly activate = output<void>();

  readonly count = rxResource({
    params: () => this.locationId() ?? undefined,
    stream: ({ params }) =>
      this.#inventory.countLowStock(params).pipe(
        map((response) => response.pagination.totalItems),
        toRemoteResult(),
      ),
  });

  readonly $count = computed(() => resultValue(this.count.value()));

  reload() {
    this.count.reload();
  }
}
