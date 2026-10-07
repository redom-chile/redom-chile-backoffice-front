import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent, IconComponent } from 'src/ui';
import { CountResultDto, CountResultLineDto, formatMoney, formatQuantity, formatSignedQuantity, formatUnitCost } from '../../../../data-access';
import { formatDocumentDate } from '../../../../shared';
import { CountSheetItem } from '../../data-access';

type SummaryLine = CountResultLineDto & Readonly<{ label: string; sku: string; unitName: string | null }>;

/** Resultado de un conteo confirmado: valor neto, líneas con diferencia y las sin diferencia plegadas. */
@Component({
  selector: 'app-count-summary',
  imports: [RouterLink, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let summary = result();
    <div class="space-y-4">
      <section class="glass rounded-[1rem] p-4">
        <div class="flex items-start gap-3">
          <app-icon class="h-6 w-6 shrink-0 text-green-600 dark:text-green-400">task_alt</app-icon>
          <div class="min-w-0">
            <h2 class="text-foreground font-semibold">Conteo registrado</h2>
            <p class="text-muted-foreground text-sm">
              {{ locationName() }} · {{ formatDate(documentDate()) }} · {{ summary.lines.length }}
              {{ summary.lines.length === 1 ? 'ítem contado' : 'ítems contados' }}
            </p>
          </div>
        </div>

        <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="border-border/60 rounded-lg border p-3">
            <dt class="text-muted-foreground text-xs">Diferencia neta valorizada</dt>
            <dd
              class="mt-1 text-2xl font-semibold tabular-nums"
              [class]="
                summary.netDifferenceValue < 0
                  ? 'text-red-600 dark:text-red-400'
                  : summary.netDifferenceValue > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-foreground'
              ">
              {{ signedMoney(summary.netDifferenceValue) }}
            </dd>
            <dd class="text-muted-foreground mt-1 text-xs">
              {{ summary.netDifferenceValue < 0 ? 'Valor perdido (faltante neto).' : summary.netDifferenceValue > 0 ? 'Sobrante neto.' : 'Sin diferencia de valor.' }}
            </dd>
          </div>
          <div class="border-border/60 rounded-lg border p-3">
            <dt class="text-muted-foreground text-xs">Líneas con diferencia</dt>
            <dd class="text-foreground mt-1 text-2xl font-semibold tabular-nums">{{ summary.linesWithDifference }}</dd>
            <dd class="text-muted-foreground mt-1 text-xs">Solo estas generan movimientos en el kardex.</dd>
          </div>
        </dl>
      </section>

      <section class="glass overflow-hidden rounded-[1rem]">
        <h3 class="text-foreground px-4 pb-2 pt-4 font-semibold">Diferencias</h3>
        @if ($withDifference().length === 0) {
        <p class="text-muted-foreground px-4 pb-4 text-sm">Todo cuadró: lo contado coincide con el stock del sistema.</p>
        } @else {
        <!-- Escritorio -->
        <div class="hidden overflow-x-auto md:block">
          <table class="min-w-full">
            <thead>
              <tr class="text-muted-foreground border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider">
                <th class="px-4 py-3">Ítem</th>
                <th class="px-4 py-3 text-right">Sistema</th>
                <th class="px-4 py-3 text-right">Contado</th>
                <th class="px-4 py-3 text-right">Diferencia</th>
                <th class="px-4 py-3 text-right">Costo unitario</th>
                <th class="px-4 py-3 text-right">Valor diferencia</th>
              </tr>
            </thead>
            <tbody>
              @for (line of $withDifference(); track line.variationId) {
              <tr class="border-b border-[var(--border)] last:border-0">
                <td class="px-4 py-3">
                  <p class="text-foreground text-sm font-medium">{{ line.label }}</p>
                  @if (line.sku) {
                  <p class="text-muted-foreground font-mono text-xs">{{ line.sku }}</p>
                  }
                </td>
                <td class="text-muted-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatQuantity(line.systemQuantity, line.unitName) }}</td>
                <td class="text-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatQuantity(line.countedQuantity, line.unitName) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums" [class]="toneClass(line.difference)">
                  {{ formatSignedQuantity(line.difference, line.unitName) }}
                  <span class="block text-xs font-normal">{{ line.difference < 0 ? 'Faltante' : 'Sobrante' }}</span>
                </td>
                <td class="text-muted-foreground whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{{ formatUnitCost(line.unitCost) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums" [class]="toneClass(line.differenceValue)">
                  {{ signedMoney(line.differenceValue) }}
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Móvil -->
        <ul class="divide-y divide-[var(--border)] md:hidden">
          @for (line of $withDifference(); track line.variationId) {
          <li class="px-4 py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-foreground truncate text-sm font-medium">{{ line.label }}</p>
                <p class="text-muted-foreground text-xs">
                  Sistema {{ formatQuantity(line.systemQuantity, line.unitName) }} · Contado {{ formatQuantity(line.countedQuantity, line.unitName) }}
                </p>
                <p class="text-muted-foreground text-xs">Costo unitario {{ formatUnitCost(line.unitCost) }}</p>
              </div>
              <div class="text-right">
                <p class="whitespace-nowrap text-sm font-semibold tabular-nums" [class]="toneClass(line.difference)">
                  {{ formatSignedQuantity(line.difference, line.unitName) }}
                </p>
                <p class="whitespace-nowrap text-xs font-semibold tabular-nums" [class]="toneClass(line.differenceValue)">
                  {{ signedMoney(line.differenceValue) }}
                </p>
              </div>
            </div>
          </li>
          }
        </ul>
        }

        @if ($withoutDifference().length > 0) {
        <details class="border-t border-[var(--border)]">
          <summary class="text-muted-foreground hover:text-foreground cursor-pointer px-4 py-3 text-sm font-medium">
            {{ $withoutDifference().length }} {{ $withoutDifference().length === 1 ? 'ítem sin diferencia' : 'ítems sin diferencia' }}
          </summary>
          <ul class="divide-y divide-[var(--border)]">
            @for (line of $withoutDifference(); track line.variationId) {
            <li class="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span class="text-foreground min-w-0 truncate">{{ line.label }}</span>
              <span class="text-muted-foreground whitespace-nowrap tabular-nums">{{ formatQuantity(line.countedQuantity, line.unitName) }}</span>
            </li>
            }
          </ul>
        </details>
        }
      </section>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <a
          routerLink="/inventory/counts"
          class="text-muted-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold">
          Volver a conteos
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
        <app-button type="button" impact="bold" tone="primary" icon="add" (buttonClick)="newCount.emit()">Nuevo conteo</app-button>
      </div>
    </div>
  `,
})
export class CountSummaryComponent {
  readonly result = input.required<CountResultDto>();
  // Ítems de la planilla por variationId (nombre y unidad base).
  readonly items = input.required<ReadonlyMap<number, CountSheetItem>>();
  readonly locationName = input('');
  readonly documentDate = input('');
  readonly newCount = output<void>();

  readonly formatQuantity = formatQuantity;
  readonly formatSignedQuantity = formatSignedQuantity;
  readonly formatUnitCost = formatUnitCost;
  readonly formatDate = formatDocumentDate;

  readonly #lines = computed((): SummaryLine[] => {
    const items = this.items();
    return this.result().lines.map((line) => {
      const item = items.get(line.variationId);
      return {
        ...line,
        label: item?.label ?? `Ítem ${line.variationId}`,
        sku: item?.sku ?? '',
        unitName: item?.baseUnitName ?? null,
      };
    });
  });

  // Mayor impacto primero.
  readonly $withDifference = computed(() =>
    this.#lines()
      .filter((line) => line.difference !== 0)
      .sort((a, b) => Math.abs(b.differenceValue) - Math.abs(a.differenceValue)),
  );
  readonly $withoutDifference = computed(() => this.#lines().filter((line) => line.difference === 0));

  toneClass(value: number): string {
    return value < 0 ? 'text-red-600 dark:text-red-400' : value > 0 ? 'text-green-600 dark:text-green-400' : 'text-foreground';
  }

  signedMoney(value: number): string {
    const text = formatMoney(Math.abs(value));
    return value < 0 ? `−${text}` : value > 0 ? `+${text}` : text;
  }
}
