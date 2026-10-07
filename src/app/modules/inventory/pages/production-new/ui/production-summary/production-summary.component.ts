import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, IconComponent } from 'src/ui';
import { formatMoney, formatQuantity, formatUnitCost, ProductionResultDto } from '../../../../data-access';
import { formatDocumentDate } from '../../../../shared';

/** Nombre y unidad base de un ingrediente de la receta (por variationId). */
export type ConsumedItemInfo = Readonly<{ name: string; unitName: string | null }>;

/** Resultado de una producción: lo producido, su costo y lo que consumió cada ingrediente. */
@Component({
  selector: 'app-production-summary',
  imports: [RouterLink, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let summary = result();
    @let unit = unitName();
    <div class="space-y-4">
      <section class="glass rounded-[1rem] p-4">
        <div class="flex items-start gap-3">
          <app-icon class="h-6 w-6 shrink-0 text-green-600 dark:text-green-400">task_alt</app-icon>
          <div class="min-w-0">
            <h2 class="text-foreground font-semibold">Producción registrada</h2>
            <p class="text-muted-foreground text-sm">
              {{ preparationName() }} · {{ locationName() }} · {{ formatDate(documentDate()) }}
            </p>
          </div>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div class="border-border/60 rounded-lg border p-3">
            <dt class="text-muted-foreground text-xs">Producido</dt>
            <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatQuantity(summary.producedQuantity, unit) }}</dd>
            <dd class="text-muted-foreground mt-1 text-xs">{{ formatQuantity(round(summary.batches)) }} {{ summary.batches === 1 ? 'tanda' : 'tandas' }}</dd>
          </div>
          <div class="border-border/60 rounded-lg border p-3">
            <dt class="text-muted-foreground text-xs">Costo total</dt>
            <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatMoney(summary.totalCost) }}</dd>
          </div>
          <div class="border-border/60 rounded-lg border p-3">
            <dt class="text-muted-foreground text-xs">Costo por {{ unit ?? 'unidad' }}</dt>
            <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatUnitCost(summary.unitCost) }}</dd>
          </div>
          <div class="border-border/60 rounded-lg border p-3">
            <dt class="text-muted-foreground text-xs">Stock de la preparación</dt>
            <dd class="text-foreground mt-1 text-xl font-semibold tabular-nums">{{ formatQuantity(summary.balanceAfter, unit) }}</dd>
            <dd class="text-muted-foreground mt-1 text-xs">Saldo en el local después de producir.</dd>
          </div>
        </dl>
      </section>

      <section class="glass overflow-hidden rounded-[1rem]">
        <h3 class="text-foreground px-4 pb-2 pt-4 font-semibold">Ingredientes consumidos</h3>
        @if (!$lines().length) {
        <p class="text-muted-foreground px-4 pb-4 text-sm">No se consumieron ingredientes.</p>
        } @else {
        <!-- Escritorio -->
        <div class="hidden overflow-x-auto md:block">
          <table class="min-w-full">
            <thead>
              <tr class="text-muted-foreground border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider">
                <th class="px-4 py-3">Ingrediente</th>
                <th class="px-4 py-3 text-right">Consumido</th>
                <th class="px-4 py-3 text-right">Costo unitario</th>
                <th class="px-4 py-3 text-right">Costo</th>
                <th class="px-4 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              @for (line of $lines(); track line.variationId) {
              <tr class="border-b border-[var(--border)] last:border-0">
                <td class="text-foreground px-4 py-3 text-sm font-medium">{{ line.name }}</td>
                <td class="text-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatQuantity(line.consumed, line.unitName) }}</td>
                <td class="text-muted-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatUnitCost(line.unitCost) }}</td>
                <td class="text-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatMoney(line.cost) }}</td>
                <td class="text-muted-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatQuantity(line.balanceAfter, line.unitName) }}</td>
              </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Móvil -->
        <ul class="divide-y divide-[var(--border)] md:hidden">
          @for (line of $lines(); track line.variationId) {
          <li class="flex items-start justify-between gap-3 px-4 py-3">
            <div class="min-w-0">
              <p class="text-foreground break-words text-sm font-medium">{{ line.name }}</p>
              <p class="text-muted-foreground text-xs">Saldo {{ formatQuantity(line.balanceAfter, line.unitName) }}</p>
            </div>
            <div class="text-right">
              <p class="text-foreground whitespace-nowrap text-sm tabular-nums">{{ formatQuantity(line.consumed, line.unitName) }}</p>
              <p class="text-muted-foreground whitespace-nowrap text-xs tabular-nums">{{ formatMoney(line.cost) }}</p>
            </div>
          </li>
          }
        </ul>
        }
      </section>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <a
          routerLink="/inventory/productions"
          class="text-muted-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold">
          Volver a producción
        </a>
        <a
          routerLink="/inventory/kardex"
          [queryParams]="{ documentId: summary.documentId }"
          class="border-border/60 text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2 text-sm font-semibold">
          <app-icon class="h-5 w-5">timeline</app-icon>
          Ver kardex
        </a>
        <a
          [routerLink]="['/inventory/documents', summary.documentId]"
          class="border-border/60 text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2 text-sm font-semibold">
          <app-icon class="h-5 w-5">description</app-icon>
          Ver documento
        </a>
        <app-button type="button" impact="bold" tone="primary" icon="add" (buttonClick)="newProduction.emit()">Nueva producción</app-button>
      </div>
    </div>
  `,
})
export class ProductionSummaryComponent {
  readonly result = input.required<ProductionResultDto>();
  // Ingredientes de la receta por variationId (el resultado solo trae ids).
  readonly items = input<ReadonlyMap<number, ConsumedItemInfo>>(new Map());
  readonly preparationName = input('');
  readonly unitName = input<string | null>(null);
  readonly locationName = input('');
  readonly documentDate = input('');
  readonly newProduction = output<void>();

  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatUnitCost = formatUnitCost;
  protected readonly formatDate = formatDocumentDate;

  // El backend devuelve la cantidad negativa (salida): se muestra en positivo como "consumido".
  protected readonly $lines = computed(() => {
    const items = this.items();
    return this.result().consumed.map((line) => {
      const item = items.get(line.variationId);
      const consumed = Math.abs(Number(line.quantity));
      return {
        variationId: line.variationId,
        name: item?.name ?? `Ingrediente ${line.variationId}`,
        unitName: item?.unitName ?? null,
        consumed,
        unitCost: Number(line.unitCost),
        cost: consumed * Number(line.unitCost),
        balanceAfter: Number(line.balanceAfter),
      };
    });
  });

  protected round(value: number): number {
    return Math.round(value * 10000) / 10000;
  }
}
