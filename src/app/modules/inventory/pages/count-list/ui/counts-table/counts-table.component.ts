import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { formatMoney, InventoryDocumentDto } from '../../../../data-access';
import { formatDocumentDate } from '../../../../shared';

/**
 * Tabla de conteos (documentos type=count). En móvil, tarjetas.
 * linesCount = solo líneas con diferencia; totalCost = Σ |valor de la diferencia|.
 */
@Component({
  selector: 'app-counts-table',
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass overflow-hidden rounded-[1rem]">
      @if (loading()) {
      <div class="divide-y divide-[var(--border)]">
        @for (row of skeletonRows; track row) {
        <div class="flex items-center gap-4 px-4 py-4">
          <app-skeleton size="xs" style="width: 90px" />
          <app-skeleton size="xs" style="width: 140px" />
          <app-skeleton size="xs" class="hidden md:block" style="width: 160px" />
          <div class="ml-auto"><app-skeleton size="xs" style="width: 80px" /></div>
        </div>
        }
      </div>
      } @else if (documents().length === 0) {
      <div class="px-4 py-12 text-center">
        <p class="text-foreground font-medium">Sin conteos</p>
        <p class="text-muted-foreground mt-1 text-sm">
          {{ hasFilters() ? 'No hay conteos que coincidan con los filtros.' : 'Todavía no hay conteos registrados.' }}
        </p>
        @if (hasFilters()) {
        <button type="button" class="text-primary mt-3 text-sm font-medium hover:underline" (click)="clearFilters.emit()">Limpiar filtros</button>
        }
      </div>
      } @else {
      <!-- Escritorio -->
      <div class="hidden overflow-x-auto md:block">
        <table class="min-w-full">
          <thead>
            <tr class="text-muted-foreground border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider">
              <th class="px-4 py-3">Fecha</th>
              <th class="px-4 py-3">Local</th>
              <th class="px-4 py-3">Notas</th>
              <th class="px-4 py-3 text-right">Líneas con diferencia</th>
              <th class="px-4 py-3 text-right" title="Suma de faltantes y sobrantes valorizados, sin signo">Valor ajustado</th>
              <th class="hidden px-4 py-3 lg:table-cell">Creado por</th>
              <th class="px-4 py-3"><span class="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            @for (document of documents(); track document.id) {
            <tr class="glass-row cursor-pointer border-b border-[var(--border)] transition-colors last:border-0" [routerLink]="['/inventory/documents', document.id]" [state]="{ document }">
              <td class="text-foreground whitespace-nowrap px-4 py-3 text-sm">{{ formatDate(document.documentDate) }}</td>
              <td class="text-foreground px-4 py-3 text-sm">{{ document.locationName }}</td>
              <td class="text-muted-foreground px-4 py-3 text-sm">
                <p class="max-w-[16rem] truncate" [title]="document.notes ?? ''">{{ document.notes ?? '—' }}</p>
              </td>
              <td class="text-muted-foreground px-4 py-3 text-right text-sm tabular-nums">{{ document.linesCount }}</td>
              <td class="text-foreground whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{{ formatMoney(document.totalCost) }}</td>
              <td class="text-muted-foreground hidden px-4 py-3 text-sm lg:table-cell">{{ document.createdBy ?? '—' }}</td>
              <td class="px-4 py-3 text-right">
                <a
                  [routerLink]="['/inventory/documents', document.id]"
                  [state]="{ document }"
                  [attr.aria-label]="'Ver conteo ' + document.id"
                  class="text-muted-foreground hover:text-primary inline-flex h-8 w-8 items-center justify-center rounded-md"
                  (click)="$event.stopPropagation()">
                  <app-icon class="h-5 w-5">chevron_right</app-icon>
                </a>
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Móvil -->
      <ul class="divide-y divide-[var(--border)] md:hidden">
        @for (document of documents(); track document.id) {
        <li>
          <a [routerLink]="['/inventory/documents', document.id]" [state]="{ document }" class="glass-row flex items-start gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-foreground truncate text-sm font-semibold">{{ document.locationName }}</p>
              <p class="text-muted-foreground truncate text-xs">
                {{ formatDate(document.documentDate) }}@if (document.notes) { · {{ document.notes }} }
              </p>
              <p class="text-muted-foreground text-xs">
                {{ document.linesCount }} {{ document.linesCount === 1 ? 'línea con diferencia' : 'líneas con diferencia' }}
              </p>
            </div>
            <span class="text-foreground whitespace-nowrap text-sm font-semibold tabular-nums">{{ formatMoney(document.totalCost) }}</span>
          </a>
        </li>
        }
      </ul>
      }

      @if (pagination(); as meta) { @if (meta.totalItems > 0 && !loading()) {
      <div class="border-t border-[var(--border)] px-4 pb-3">
        <app-pagination-table [pagination]="meta" (pageChange)="pageChange.emit($event)" />
      </div>
      } }
    </div>
  `,
})
export class CountsTableComponent {
  readonly documents = input.required<readonly InventoryDocumentDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly hasFilters = input(false);
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly formatMoney = formatMoney;
  readonly formatDate = formatDocumentDate;
}
