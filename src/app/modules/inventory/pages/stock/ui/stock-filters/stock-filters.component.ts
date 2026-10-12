import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter, Subject } from 'rxjs';
import { IconComponent } from 'src/ui';
import { StockKind } from '../../../../data-access';

export type StockFilters = Readonly<{
  search: string;
  kind: StockKind | null;
  lowStock: boolean;
}>;

const KIND_OPTIONS: ReadonlyArray<{ value: StockKind | null; label: string }> = [
  { value: null, label: 'Todos' },
  { value: 'ingredient', label: 'Ingredientes' },
  { value: 'product', label: 'Productos' },
];

/** Buscador (con espera al escribir), tipo de ítem y "Solo bajo mínimo". */
@Component({
  selector: 'app-stock-filters',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = filters();
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <label class="relative block sm:w-64">
        <span class="sr-only">Buscar</span>
        <app-icon class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2">search</app-icon>
        <input
          type="search"
          placeholder="Buscar por nombre o SKU"
          class="glass-input w-full rounded-md py-2 pl-10 pr-3"
          [value]="$search()"
          (input)="onSearch($event)" />
      </label>

      <div class="glass-input inline-flex self-start rounded-md p-1" role="group" aria-label="Tipo">
        @for (option of kinds; track option.label) {
        <button
          type="button"
          class="rounded px-3 py-1 text-sm transition"
          [class.bg-primary]="f.kind === option.value"
          [class.text-primary-foreground]="f.kind === option.value"
          [class.text-muted-foreground]="f.kind !== option.value"
          [attr.aria-pressed]="f.kind === option.value"
          (click)="filtersChange.emit({ kind: option.value })">
          {{ option.label }}
        </button>
        }
      </div>

      <label class="text-foreground flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4 accent-[var(--primary)]" [checked]="f.lowStock" (change)="onLowStock($event)" />
        Solo bajo mínimo
      </label>

      @if (hasFilters()) {
      <button type="button" class="text-primary self-start text-sm font-medium hover:underline sm:self-auto" (click)="clear.emit()">Limpiar filtros</button>
      }
    </div>
  `,
})
export class StockFiltersComponent {
  readonly filters = input.required<StockFilters>();
  readonly hasFilters = input(false);
  readonly filtersChange = output<Partial<StockFilters>>();
  readonly clear = output<void>();

  readonly kinds = KIND_OPTIONS;
  // Texto local del buscador: se sincroniza con la URL y se emite con espera.
  readonly $search = signal('');
  readonly #search$ = new Subject<string>();

  constructor() {
    effect(() => {
      const search = this.filters().search;
      untracked(() => this.$search.set(search));
    });
    this.#search$
      .pipe(
        debounceTime(350),
        filter((search) => search !== this.filters().search),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((search) => this.filtersChange.emit({ search }));
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$search.set(value);
    this.#search$.next(value.trim());
  }

  onLowStock(event: Event) {
    this.filtersChange.emit({ lowStock: (event.target as HTMLInputElement).checked });
  }
}
