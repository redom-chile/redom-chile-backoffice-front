import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from 'src/ui';
import { formatMoney, formatQuantity, formatUnitCost } from '../../../../data-access';
import { EstimateLine, ProductionEstimate } from '../../data-access';

/** Saldo de un ingrediente en el local: número, null = no se encontró, undefined = cargando. */
export type IngredientStock = Readonly<Record<number, number | null>>;

/** "Consumo estimado" antes de confirmar: tandas, lo que consume cada ingrediente, stock del local y costo. */
@Component({
  selector: 'app-production-estimate',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = estimate();
    <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="border-border/60 rounded-lg border p-3">
        <dt class="text-muted-foreground text-xs">Tandas</dt>
        <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatQuantity(round(data.batches)) }}</dd>
        <dd class="text-muted-foreground mt-1 text-xs">La receta rinde {{ formatQuantity(recipeYield(), unitName()) }} por tanda.</dd>
      </div>
      <div class="border-border/60 rounded-lg border p-3">
        <dt class="text-muted-foreground text-xs">Costo estimado</dt>
        <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatMoney(data.totalCost) }}</dd>
      </div>
      <div class="border-border/60 rounded-lg border p-3">
        <dt class="text-muted-foreground text-xs">Costo estimado por {{ unitName() ?? 'unidad' }}</dt>
        <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatUnitCost(data.unitCost) }}</dd>
      </div>
    </dl>

    @if (data.missingCost) {
    <p class="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <app-icon class="mt-px h-4 w-4 shrink-0" aria-hidden="true">warning</app-icon>
      <span>Hay ingredientes sin costo (falta registrar una compra con costo): el costo queda subestimado.</span>
    </p>
    }

    <!-- Escritorio -->
    <div class="mt-3 hidden overflow-x-auto md:block">
      <table class="min-w-full">
        <thead>
          <tr class="text-muted-foreground border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider">
            <th class="px-3 py-2">Ingrediente</th>
            <th class="px-3 py-2 text-right">Consume</th>
            <th class="px-3 py-2 text-right">Stock en el local</th>
            <th class="px-3 py-2 text-right">Costo unitario</th>
            <th class="px-3 py-2 text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          @for (line of data.lines; track line.variationId) {
          @let short = isShort(line);
          <tr class="border-b border-[var(--border)] last:border-0">
            <td class="text-foreground px-3 py-2 text-sm font-medium">{{ line.name }}</td>
            <td class="text-foreground whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">{{ formatQuantity(line.quantity, line.unitName) }}</td>
            <td class="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums" [class]="short ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'">
              {{ stockLabel(line) }}
              @if (short) { <span class="block text-xs font-normal">No alcanza</span> }
            </td>
            <td class="text-muted-foreground whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums">{{ line.unitCost ? formatUnitCost(line.unitCost) : 'sin costo' }}</td>
            <td class="text-foreground whitespace-nowrap px-3 py-2 text-right text-sm font-medium tabular-nums">{{ formatMoney(line.cost) }}</td>
          </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Móvil -->
    <ul class="mt-3 divide-y divide-[var(--border)] md:hidden">
      @for (line of data.lines; track line.variationId) {
      @let short = isShort(line);
      <li class="flex items-start justify-between gap-3 py-2">
        <div class="min-w-0">
          <p class="text-foreground break-words text-sm font-medium">{{ line.name }}</p>
          <p class="text-xs" [class]="short ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'">
            Stock {{ stockLabel(line) }}@if (short) { · no alcanza }
          </p>
        </div>
        <div class="text-right">
          <p class="text-foreground whitespace-nowrap text-sm tabular-nums">{{ formatQuantity(line.quantity, line.unitName) }}</p>
          <p class="text-muted-foreground whitespace-nowrap text-xs tabular-nums">{{ formatMoney(line.cost) }}</p>
        </div>
      </li>
      }
    </ul>
  `,
})
export class ProductionEstimateComponent {
  readonly estimate = input.required<ProductionEstimate>();
  readonly recipeYield = input.required<number>();
  // Unidad de la preparación.
  readonly unitName = input<string | null>(null);
  readonly stock = input<IngredientStock>({});

  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatUnitCost = formatUnitCost;

  protected round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }

  protected stockLabel(line: EstimateLine): string {
    const stock = this.stock()[line.variationId];
    if (stock === undefined) return '…';
    if (stock === null) return '—';
    return formatQuantity(stock, line.unitName);
  }

  protected isShort(line: EstimateLine): boolean {
    const stock = this.stock()[line.variationId];
    return typeof stock === 'number' && stock < line.quantity;
  }
}
