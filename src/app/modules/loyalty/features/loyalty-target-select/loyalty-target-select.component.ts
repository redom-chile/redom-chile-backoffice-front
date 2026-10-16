import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { CategoryDto } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { ApiPathEnum } from 'src/environments';
import { IconComponent } from 'src/ui';

type Option = Readonly<{ id: number; name: string }>;

// Máximo por página del backend.
const PAGE_SIZE = 100;

/** Varios productos o categorías (sellos por unidad). Los ids van en `value`. */
@Component({
  selector: 'app-loyalty-target-select',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value().length) {
    <ul class="mb-2 flex flex-wrap gap-1.5" aria-label="Elegidos">
      @for (id of value(); track id) {
      <li class="bg-primary/10 text-foreground inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm">
        <span class="truncate">{{ nameOf(id) }}</span>
        @if (!disabled()) {
        <button type="button" class="hover:bg-primary/20 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full" [attr.aria-label]="'Quitar ' + nameOf(id)" (click)="toggle(id)">
          <app-icon class="h-4 w-4" aria-hidden="true">close</app-icon>
        </button>
        }
      </li>
      }
    </ul>
    }
    @if (!disabled()) {
    <div class="relative">
      <app-icon class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true">search</app-icon>
      <input
        type="search"
        [id]="inputId()"
        class="glass-input w-full rounded-md py-2 pl-9 pr-3 text-sm"
        [class.border-red-500]="invalid()"
        [placeholder]="type() === 'category' ? 'Buscar categoría' : 'Buscar producto'"
        autocomplete="off"
        [value]="$search()"
        (input)="$search.set($any($event.target).value)" />
    </div>
    <div class="glass-row mt-1 max-h-56 overflow-y-auto rounded-md">
      @if ($error()) {
      <p class="text-muted-foreground p-3 text-center text-xs">No se pudo cargar la lista.</p>
      } @else if ($loading() && !$options().length) {
      <p class="text-muted-foreground p-3 text-center text-xs">Cargando…</p>
      } @else if (!$options().length) {
      <p class="text-muted-foreground p-3 text-center text-xs">Sin resultados.</p>
      } @else {
      <ul class="divide-y divide-[var(--border)]" [class.opacity-60]="$loading()">
        @for (option of $options(); track option.id) {
        @let checked = $selected().has(option.id);
        <li>
          <button
            type="button"
            class="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
            [attr.aria-pressed]="checked"
            (click)="toggle(option.id)">
            <span class="text-foreground min-w-0 truncate">{{ option.name }}</span>
            <app-icon class="h-5 w-5 shrink-0" [class]="checked ? 'text-primary' : 'text-muted-foreground'" aria-hidden="true">
              {{ checked ? 'check_box' : 'check_box_outline_blank' }}
            </app-icon>
          </button>
        </li>
        }
      </ul>
      }
    </div>
    }
  `,
})
export class LoyaltyTargetSelectComponent {
  readonly #http = inject(HttpClient);

  readonly type = input.required<'product' | 'category'>();
  readonly value = model<number[]>([]);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly inputId = input('');

  readonly $search = signal('');
  readonly #term = toSignal(toObservable(this.$search).pipe(map((value) => value.trim()), debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });
  readonly $selected = computed(() => new Set(this.value()));
  // Nombres ya vistos, para los chips de lo elegido que no está en la búsqueda actual.
  readonly #names = signal(new Map<number, string>());

  readonly products = rxResource({
    params: () => (this.type() === 'product' ? { name: this.#term() } : undefined),
    stream: ({ params }) => {
      let httpParams = new HttpParams().set('page', 1).set('perPage', PAGE_SIZE).set('isActive', true);
      if (params.name) httpParams = httpParams.set('name', params.name);
      return this.#http.get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params: httpParams }).pipe(
        map(({ data }) =>
          data.filter((product) => product.type !== 'modifier' && product.type !== 'ingredient').map((product) => ({ id: product.id, name: product.name })),
        ),
        toRemoteResult(),
      );
    },
  });

  readonly categories = rxResource({
    params: () => (this.type() === 'category' ? true : undefined),
    stream: () =>
      this.#http.get<CategoryDto[]>(`${ApiPathEnum.RESTAURANT}/categories`).pipe(
        map((categories) =>
          categories.flatMap((category) => [
            { id: category.id, name: category.name },
            ...(category.subcategories ?? []).map((sub) => ({ id: sub.id, name: `${category.name} › ${sub.name}` })),
          ]),
        ),
        toRemoteResult(),
      ),
  });

  readonly $loading = computed(() => (this.type() === 'category' ? this.categories.isLoading() : this.products.isLoading()));
  readonly $error = computed(() => (this.type() === 'category' ? resultError(this.categories.value()) : resultError(this.products.value())));
  readonly $options = computed<Option[]>(() => {
    if (this.type() === 'product') return resultValue(this.products.value()) ?? [];
    const term = normalize(this.#term());
    return (resultValue(this.categories.value()) ?? []).filter((category) => !term || normalize(category.name).includes(term));
  });

  constructor() {
    effect(() => {
      const options = this.type() === 'product' ? resultValue(this.products.value()) : resultValue(this.categories.value());
      if (!options?.length) return;
      this.#names.update((names) => {
        const next = new Map(names);
        for (const option of options) next.set(option.id, option.name);
        return next;
      });
    });
  }

  nameOf(id: number): string {
    return this.#names().get(id) ?? (this.type() === 'category' ? `Categoría #${id}` : `Producto #${id}`);
  }

  toggle(id: number) {
    this.value.update((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));
  }
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
