import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { DIFFERENCE_CLASSES, differenceTone } from '../cash-format';

/** Diferencia de caja con color: rojo faltante, verde sobrante, "Cuadrada" en 0 y "—" sin dato. */
@Component({
  selector: 'app-cash-difference',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch ($tone()) {
    @case ('none') { <span class="text-muted-foreground">—</span> }
    @case ('even') {
    <span class="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">Cuadrada</span>
    }
    @default {
    <span class="font-semibold tabular-nums" [class]="$class()">
      {{ $sign() }}{{ $amount() }}
      @if (showLabel()) {
      <span class="text-xs font-normal">{{ $tone() === 'short' ? 'faltante' : 'sobrante' }}</span>
      }
    </span>
    }
    }
  `,
})
export class CashDifferenceComponent {
  readonly value = input<number | null | undefined>(null);
  readonly showLabel = input(true);

  readonly $tone = computed(() => differenceTone(this.value()));
  readonly $class = computed(() => DIFFERENCE_CLASSES[this.$tone()]);
  readonly $sign = computed(() => ((this.value() ?? 0) < 0 ? '−' : '+'));
  readonly $amount = computed(() => formatCurrency(Math.abs(this.value() ?? 0)));
}
