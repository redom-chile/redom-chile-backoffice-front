import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ADJUSTMENT_REASONS, AdjustmentReason } from '../../../data-access';

export type DocumentFilters = Readonly<{
  locationId: number | null;
  reason: AdjustmentReason | null;
  from: string | null;
  to: string | null;
}>;

export type DocumentFilterLocation = Readonly<{ id: number; name: string }>;

/** Filtros de compras y ajustes: local (opcional), motivo (solo ajustes) y rango de fechas del documento. */
@Component({
  selector: 'app-documents-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = filters();
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <select aria-label="Filtrar por local" class="glass-input rounded-md px-3 py-2 sm:w-52" (change)="onLocation($event)">
        <option value="" [selected]="!f.locationId">Todos los locales</option>
        @for (location of locations(); track location.id) {
        <option [value]="location.id" [selected]="f.locationId === location.id">{{ location.name }}</option>
        }
      </select>

      @if (showReason()) {
      <select aria-label="Filtrar por motivo" class="glass-input rounded-md px-3 py-2 sm:w-52" (change)="onReason($event)">
        <option value="" [selected]="!f.reason">Todos los motivos</option>
        @for (reason of reasons; track reason.value) {
        <option [value]="reason.value" [selected]="f.reason === reason.value">{{ reason.label }}</option>
        }
      </select>
      }

      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground w-12 sm:w-auto">Desde</span>
        <input type="date" aria-label="Desde" class="glass-input flex-1 rounded-md px-3 py-2" [value]="f.from ?? ''" [max]="f.to ?? ''" (change)="onDate('from', $event)" />
      </label>
      <label class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground w-12 sm:w-auto">Hasta</span>
        <input type="date" aria-label="Hasta" class="glass-input flex-1 rounded-md px-3 py-2" [value]="f.to ?? ''" [min]="f.from ?? ''" (change)="onDate('to', $event)" />
      </label>

      @if (hasFilters()) {
      <button type="button" class="text-primary self-start text-sm font-medium hover:underline sm:self-auto" (click)="clear.emit()">Limpiar filtros</button>
      }
    </div>
  `,
})
export class DocumentsFiltersComponent {
  readonly filters = input.required<DocumentFilters>();
  readonly locations = input<readonly DocumentFilterLocation[]>([]);
  readonly showReason = input(false);
  readonly hasFilters = input(false);
  readonly filtersChange = output<Partial<DocumentFilters>>();
  readonly clear = output<void>();

  readonly reasons = ADJUSTMENT_REASONS;

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.filtersChange.emit({ locationId: value > 0 ? value : null });
  }

  onReason(event: Event) {
    const value = (event.target as HTMLSelectElement).value as AdjustmentReason | '';
    this.filtersChange.emit({ reason: value || null });
  }

  onDate(field: 'from' | 'to', event: Event) {
    this.filtersChange.emit({ [field]: (event.target as HTMLInputElement).value || null });
  }
}
