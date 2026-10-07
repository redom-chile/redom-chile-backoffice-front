import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap, tap } from 'rxjs';
import { ClickOutsideDirective, IconComponent } from 'src/ui';
import { StockableItem, StockableItemsService } from '../../../../data-access';

const KIND_LABELS: Record<StockableItem['kind'], string> = { ingredient: 'Ingrediente', product: 'Producto' };

/** Buscador de ingredientes (y productos con stock propio) para agregar a una receta. */
@Component({
  selector: 'app-recipe-ingredient-search',
  imports: [IconComponent, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" (clickOutside)="close()">
      <label [for]="inputId()" class="sr-only">Agregar ingrediente</label>
      <div class="relative">
        <app-icon class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2" aria-hidden="true">
          add
        </app-icon>
        <input
          [id]="inputId()"
          type="text"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-controls]="inputId() + '-results'"
          [attr.aria-expanded]="$isOpen()"
          placeholder="Agregar ingrediente: busca por nombre…"
          class="glass-input w-full rounded-md py-2 pr-3 pl-10"
          [disabled]="disabled()"
          [value]="$term()"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (keydown)="onKeydown($event)" />
      </div>

      @if ($isOpen()) {
      <ul
        [id]="inputId() + '-results'"
        role="listbox"
        class="bg-background border-border absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border shadow-lg">
        @if ($isSearching()) {
        <li class="text-muted-foreground px-3 py-3 text-sm">Buscando…</li>
        } @else if ($failed()) {
        <li class="text-destructive px-3 py-3 text-sm">No se pudo buscar. Intenta nuevamente.</li>
        } @else {
        @for (item of $results(); track item.variationId; let i = $index) {
        @let added = isAdded(item);
        <li
          role="option"
          [attr.aria-selected]="i === $activeIndex()"
          class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
          [class]="i === $activeIndex() ? 'bg-primary/10' : ''"
          [class.opacity-60]="added"
          (mouseenter)="$activeIndex.set(i)"
          (click)="choose(item)">
          <div class="min-w-0">
            <p class="text-foreground truncate font-medium">{{ item.label }}</p>
            <p class="text-muted-foreground truncate text-xs">{{ item.sku }}@if (added) { · ya agregado }</p>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            [class]="item.kind === 'ingredient' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-primary/15 text-primary'">
            {{ kindLabels[item.kind] }}
          </span>
        </li>
        } @empty {
        <li class="text-muted-foreground px-3 py-3 text-sm">
          Sin resultados. Solo aparecen ingredientes y productos con "Stock propio".
        </li>
        }
        }
      </ul>
      }
    </div>
  `,
})
export class RecipeIngredientSearchComponent {
  readonly #items = inject(StockableItemsService);

  readonly inputId = input.required<string>();
  // El producto de la receta no puede consumirse a sí mismo.
  readonly excludeProductId = input<number | null>(null);
  readonly addedVariationIds = input<readonly number[]>([]);
  readonly disabled = input(false);
  readonly selected = output<StockableItem>();

  protected readonly kindLabels = KIND_LABELS;
  readonly #term$ = new Subject<string>();
  protected readonly $term = signal('');
  protected readonly $results = signal<StockableItem[]>([]);
  protected readonly $isSearching = signal(false);
  protected readonly $failed = signal(false);
  protected readonly $isOpen = signal(false);
  protected readonly $activeIndex = signal(0);

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
          this.#items.search(term, { includeIngredients: true }).pipe(
            map((items) => items.filter((item) => item.productId !== this.excludeProductId())),
            catchError(() => {
              this.$failed.set(true);
              return of<StockableItem[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((items) => {
        this.$results.set(items);
        this.$activeIndex.set(0);
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
    // Sin término muestra los primeros ítems.
    if (!this.$results().length && !this.$isSearching()) this.#term$.next(this.$term());
  }

  protected onKeydown(event: KeyboardEvent) {
    const results = this.$results();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.$isOpen.set(true);
      this.$activeIndex.update((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.$activeIndex.update((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[this.$activeIndex()];
      if (this.$isOpen() && item) this.choose(item);
    } else if (event.key === 'Escape') {
      this.$isOpen.set(false);
    }
  }

  protected isAdded(item: StockableItem): boolean {
    return this.addedVariationIds().includes(item.variationId);
  }

  protected choose(item: StockableItem) {
    this.selected.emit(item);
    this.$term.set('');
    this.$isOpen.set(false);
    this.#term$.next('');
  }

  close() {
    this.$isOpen.set(false);
  }
}
