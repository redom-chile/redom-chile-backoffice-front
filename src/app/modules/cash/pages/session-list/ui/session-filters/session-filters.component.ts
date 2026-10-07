import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CashSessionStatus } from '../../../../data-access';

export type SessionFilters = Readonly<{
  locationId: number | null;
  registerId: number | null;
  status: CashSessionStatus | null;
  from: string | null;
  to: string | null;
}>;

export type SessionFilterOption = Readonly<{ id: number; name: string }>;

/** Filtros del historial de turnos: local, caja (del local elegido), estado y fechas de apertura. */
@Component({
  selector: 'app-cash-session-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = filters();
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <select aria-label="Filtrar por local" class="glass-input rounded-md px-3 py-2 sm:w-48" (change)="onId('locationId', $event)">
        <option value="" [selected]="!f.locationId">Todos los locales</option>
        @for (location of locations(); track location.id) {
        <option [value]="location.id" [selected]="f.locationId === location.id">{{ location.name }}</option>
        }
      </select>

      <select aria-label="Filtrar por caja" class="glass-input rounded-md px-3 py-2 sm:w-48" (change)="onId('registerId', $event)">
        <option value="" [selected]="!f.registerId">Todas las cajas</option>
        @for (register of registers(); track register.id) {
        <option [value]="register.id" [selected]="f.registerId === register.id">{{ register.name }}</option>
        }
      </select>

      <select aria-label="Filtrar por estado" class="glass-input rounded-md px-3 py-2 sm:w-40" (change)="onStatus($event)">
        <option value="" [selected]="!f.status">Todos los estados</option>
        <option value="open" [selected]="f.status === 'open'">Abierta</option>
        <option value="closed" [selected]="f.status === 'closed'">Cerrada</option>
      </select>

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
export class CashSessionFiltersComponent {
  readonly filters = input.required<SessionFilters>();
  readonly locations = input<readonly SessionFilterOption[]>([]);
  readonly registers = input<readonly SessionFilterOption[]>([]);
  readonly hasFilters = input(false);
  readonly filtersChange = output<Partial<SessionFilters>>();
  readonly clear = output<void>();

  onId(field: 'locationId' | 'registerId', event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    const id = value > 0 ? value : null;
    // Al cambiar de local, la caja elegida deja de aplicar.
    this.filtersChange.emit(field === 'locationId' ? { locationId: id, registerId: null } : { registerId: id });
  }

  onStatus(event: Event) {
    const value = (event.target as HTMLSelectElement).value as CashSessionStatus | '';
    this.filtersChange.emit({ status: value || null });
  }

  onDate(field: 'from' | 'to', event: Event) {
    this.filtersChange.emit({ [field]: (event.target as HTMLInputElement).value || null });
  }
}
