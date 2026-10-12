import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, mergeMap, of, Subject, switchMap, tap } from 'rxjs';
import { ClickOutsideDirective, IconComponent } from 'src/ui';
import { RecipesService } from '../../../../data-access';
import { canProduce, PreparationProduct, PreparationsService } from '../../data-access';

// Recetas que se consultan en paralelo para saber qué resultados se pueden producir.
const STATUS_CONCURRENCY = 4;

type RecipeCheck = 'loading' | 'ready' | 'none' | 'error';

/**
 * Buscador de preparaciones: busca ingredientes por nombre y revisa su receta. Solo se pueden elegir
 * los que tienen receta de producción con ingredientes y rinde; el resto lleva al editor.
 */
@Component({
  selector: 'app-preparation-picker',
  imports: [RouterLink, IconComponent, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selected(); as current) {
    <div class="border-border/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <app-icon class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true">soup_kitchen</app-icon>
        <div class="min-w-0">
          <p class="text-foreground truncate text-sm font-medium">{{ current.name }}</p>
          @if (current.sku) {
          <p class="text-muted-foreground truncate font-mono text-xs">{{ current.sku }}</p>
          }
        </div>
      </div>
      <button
        type="button"
        class="text-primary shrink-0 text-sm font-medium hover:underline disabled:opacity-50"
        [disabled]="disabled()"
        (click)="clear()">
        Cambiar
      </button>
    </div>
    } @else {
    <div class="relative" (clickOutside)="$isOpen.set(false)">
      <label [for]="inputId()" class="sr-only">Buscar preparación</label>
      <div class="relative">
        <app-icon class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2" aria-hidden="true">
          search
        </app-icon>
        <input
          [id]="inputId()"
          type="text"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          [attr.aria-controls]="inputId() + '-results'"
          [attr.aria-expanded]="$isOpen()"
          placeholder="Busca la preparación por nombre…"
          class="glass-input w-full rounded-md py-2 pr-3 pl-10"
          [class.border-red-500]="invalid()"
          [disabled]="disabled()"
          [value]="$term()"
          (input)="onInput($event)"
          (focus)="onFocus()"
          (keydown.escape)="$isOpen.set(false)" />
      </div>

      @if ($isOpen()) {
      <ul
        [id]="inputId() + '-results'"
        role="listbox"
        class="bg-background border-border absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border shadow-lg">
        @if ($isSearching()) {
        <li class="text-muted-foreground px-3 py-3 text-sm">Buscando…</li>
        } @else if ($failed()) {
        <li class="text-destructive px-3 py-3 text-sm">No se pudo buscar. Intenta nuevamente.</li>
        } @else {
        @for (product of $results(); track product.id) {
        @let check = $checks()[product.id] ?? 'loading';
        @if (check === 'ready') {
        <li
          role="option"
          [attr.aria-selected]="false"
          tabindex="0"
          class="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm outline-none"
          (click)="choose(product)"
          (keydown.enter)="choose(product)">
          <div class="min-w-0">
            <p class="text-foreground truncate font-medium">{{ product.name }}</p>
            <p class="text-muted-foreground truncate text-xs">{{ product.sku }}</p>
          </div>
          <span class="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
            Con receta
          </span>
        </li>
        } @else {
        <li role="option" aria-disabled="true" [attr.aria-selected]="false" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div class="min-w-0 opacity-60">
            <p class="text-foreground truncate font-medium">{{ product.name }}</p>
            <p class="text-muted-foreground truncate text-xs">
              @switch (check) {
              @case ('loading') { Revisando receta… }
              @case ('error') { No se pudo revisar la receta }
              @default { Sin receta de producción (ingredientes + rinde) }
              }
            </p>
          </div>
          @if (check === 'none') {
          <a
            [routerLink]="['/inventory/recipes', product.id]"
            class="text-primary shrink-0 text-xs font-medium hover:underline">
            Armar receta
          </a>
          }
        </li>
        }
        } @empty {
        <li class="text-muted-foreground px-3 py-3 text-sm">Sin resultados. Las preparaciones son ingredientes con receta.</li>
        }
        }
      </ul>
      }
    </div>
    }
  `,
})
export class PreparationPickerComponent {
  readonly #preparations = inject(PreparationsService);
  readonly #recipes = inject(RecipesService);

  readonly inputId = input('preparation-search');
  readonly selected = input<PreparationProduct | null>(null);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly selectedChange = output<PreparationProduct | null>();

  readonly #term$ = new Subject<string>();
  readonly #check$ = new Subject<number>();
  protected readonly $term = signal('');
  protected readonly $results = signal<PreparationProduct[]>([]);
  // Estado de la receta por productId (se conserva entre búsquedas).
  protected readonly $checks = signal<Readonly<Record<number, RecipeCheck>>>({});
  protected readonly $isSearching = signal(false);
  protected readonly $failed = signal(false);
  protected readonly $isOpen = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.#term$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.$isSearching.set(true);
          this.$failed.set(false);
        }),
        switchMap((term) =>
          this.#preparations.search(term).pipe(
            catchError(() => {
              this.$failed.set(true);
              return of<PreparationProduct[]>([]);
            }),
          ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((products) => {
        this.$results.set(products);
        this.$isSearching.set(false);
        this.#queueChecks(products.map((product) => product.id));
      });

    this.#check$
      .pipe(
        mergeMap(
          (productId) =>
            this.#recipes.getByProduct(productId).pipe(
              map((data): RecipeCheck => (data.recipeKind === 'production' && data.variations.some(canProduce) ? 'ready' : 'none')),
              catchError(() => of<RecipeCheck>('error')),
              map((check) => [productId, check] as const),
            ),
          STATUS_CONCURRENCY,
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(([productId, check]) => this.$checks.update((checks) => ({ ...checks, [productId]: check })));
  }

  protected onInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.$term.set(term);
    this.$isOpen.set(true);
    this.#term$.next(term);
  }

  protected onFocus() {
    this.$isOpen.set(true);
    // Sin término muestra los primeros ingredientes.
    if (!this.$results().length && !this.$isSearching()) this.#term$.next(this.$term());
  }

  protected choose(product: PreparationProduct) {
    this.$isOpen.set(false);
    this.selectedChange.emit(product);
  }

  protected clear() {
    this.selectedChange.emit(null);
  }

  #queueChecks(ids: number[]) {
    const checks = this.$checks();
    const pending = ids.filter((id) => !checks[id] || checks[id] === 'error');
    if (!pending.length) return;
    this.$checks.update((current) => {
      const next = { ...current };
      pending.forEach((id) => (next[id] = 'loading'));
      return next;
    });
    pending.forEach((id) => this.#check$.next(id));
  }
}
