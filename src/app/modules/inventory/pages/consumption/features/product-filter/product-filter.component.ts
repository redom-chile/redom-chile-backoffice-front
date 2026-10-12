import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap, tap } from 'rxjs';
import { ClickOutsideDirective, IconComponent } from 'src/ui';
import { StockableItem, StockableItemsService } from '../../../../data-access';

/** Filtro opcional por ítem: busca ingredientes y productos con stock propio; con uno elegido muestra un chip. */
@Component({
  selector: 'app-consumption-product-filter',
  imports: [IconComponent, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as chip) {
    <span class="bg-primary/10 text-primary inline-flex max-w-full items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm font-medium">
      <span class="truncate">Ítem: {{ chip }}</span>
      <button type="button" aria-label="Quitar filtro de ítem" class="hover:bg-primary/20 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full" (click)="clear.emit()">
        <app-icon class="h-4 w-4">close</app-icon>
      </button>
    </span>
    } @else {
    <div class="relative w-full sm:w-64" (clickOutside)="$isOpen.set(false)">
      <app-icon class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2" aria-hidden="true">search</app-icon>
      <input
        type="text"
        autocomplete="off"
        role="combobox"
        aria-label="Filtrar por ítem"
        aria-controls="consumption-product-results"
        [attr.aria-expanded]="$isOpen()"
        placeholder="Filtrar por ítem…"
        class="glass-input w-full rounded-md py-2 pr-3 pl-10"
        [value]="$term()"
        (input)="onInput($event)"
        (focus)="onFocus()"
        (keydown.escape)="$isOpen.set(false)" />
      @if ($isOpen()) {
      <ul id="consumption-product-results" role="listbox" class="bg-background border-border absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-lg">
        @if ($isSearching()) {
        <li class="text-muted-foreground px-3 py-3 text-sm">Buscando…</li>
        } @else if ($failed()) {
        <li class="text-destructive px-3 py-3 text-sm">No se pudo buscar. Intenta nuevamente.</li>
        } @else {
        @for (item of $results(); track item.variationId) {
        <li role="option" aria-selected="false" class="hover:bg-primary/10 cursor-pointer px-3 py-2 text-sm" (click)="choose(item)">
          <p class="text-foreground truncate font-medium">{{ item.label }}</p>
          <p class="text-muted-foreground truncate text-xs">{{ item.sku }}</p>
        </li>
        } @empty {
        <li class="text-muted-foreground px-3 py-3 text-sm">Sin resultados.</li>
        }
        }
      </ul>
      }
    </div>
    }
  `,
})
export class ConsumptionProductFilterComponent {
  readonly #items = inject(StockableItemsService);

  // Nombre del ítem filtrado; null = sin filtro.
  readonly label = input<string | null>(null);
  readonly includeIngredients = input(true);
  readonly selected = output<StockableItem>();
  readonly clear = output<void>();

  readonly #term$ = new Subject<string>();
  protected readonly $term = signal('');
  protected readonly $results = signal<StockableItem[]>([]);
  protected readonly $isSearching = signal(false);
  protected readonly $failed = signal(false);
  protected readonly $isOpen = signal(false);

  constructor() {
    this.#term$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.$isSearching.set(true);
          this.$failed.set(false);
        }),
        switchMap((term) =>
          this.#items.search(term, { includeIngredients: this.includeIngredients() }).pipe(
            catchError(() => {
              this.$failed.set(true);
              return of<StockableItem[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((items) => {
        // El reporte filtra por producto: una fila por producto basta.
        this.$results.set(items.filter((item, index) => items.findIndex((other) => other.productId === item.productId) === index));
        this.$isSearching.set(false);
      });
  }

  protected onInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.$term.set(term);
    this.$isOpen.set(true);
    this.#term$.next(term);
  }

  protected onFocus() {
    this.$isOpen.set(true);
    if (!this.$results().length && !this.$isSearching()) this.#term$.next(this.$term());
  }

  protected choose(item: StockableItem) {
    this.selected.emit(item);
    this.$term.set('');
    this.$isOpen.set(false);
  }
}
