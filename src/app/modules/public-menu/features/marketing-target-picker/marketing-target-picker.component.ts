import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { resultError, resultValue, toRemoteResult, variationLabel } from 'src/app/modules/inventory/shared/data-access';
import { CategoryDto } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { formatMenuPrice } from 'src/app/modules/public-menu/data-access';
import { ApiPathEnum } from 'src/environments';
import { IconComponent } from 'src/ui';

export type MarketingTargetType = 'product' | 'variation' | 'category';
export type MarketingTarget = Readonly<{ id: number; name: string }>;

type Option = Readonly<{ id: number; name: string; detail: string | null }>;

// Máximo por página del backend.
const PAGE_SIZE = 100;

/** Categorías y subcategorías en una sola lista ("Bebidas › Jugos"). */
export function flattenCategories(categories: readonly CategoryDto[]): MarketingTarget[] {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name },
    ...(category.subcategories ?? []).map((sub) => ({ id: sub.id, name: `${category.name} › ${sub.name}` })),
  ]);
}

/** Buscador de producto, variación o categoría para promociones y links de banners. */
@Component({
  selector: 'app-marketing-target-picker',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selected(); as current) {
    <div class="glass-row flex items-center justify-between gap-2 rounded-md px-3 py-2" [class.border-red-500]="invalid()">
      <span class="text-foreground min-w-0 truncate text-sm font-medium">{{ current.name }}</span>
      @if (!disabled()) {
      <button type="button" class="text-primary shrink-0 text-xs font-medium hover:underline" (click)="clear()">Cambiar</button>
      }
    </div>
    } @else {
    <div class="relative">
      <app-icon class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true">search</app-icon>
      <input
        type="search"
        [id]="inputId()"
        class="glass-input w-full rounded-md py-2 pl-9 pr-3 text-sm"
        [class.border-red-500]="invalid()"
        [placeholder]="$placeholder()"
        [disabled]="disabled()"
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
        <li>
          <button type="button" class="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm" (click)="pick(option)">
            <span class="text-foreground min-w-0 truncate">{{ option.name }}</span>
            @if (option.detail) {
            <span class="text-muted-foreground shrink-0 text-xs">{{ option.detail }}</span>
            }
          </button>
        </li>
        }
      </ul>
      }
    </div>
    }
  `,
})
export class MarketingTargetPickerComponent {
  readonly #http = inject(HttpClient);

  readonly type = input.required<MarketingTargetType>();
  readonly selected = model<MarketingTarget | null>(null);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly inputId = input('');

  readonly $search = signal('');
  readonly #term = toSignal(toObservable(this.$search).pipe(map((value) => value.trim()), debounceTime(300), distinctUntilChanged()), {
    initialValue: '',
  });

  readonly $placeholder = computed(() => (this.type() === 'category' ? 'Buscar categoría' : 'Buscar producto'));

  readonly products = rxResource({
    params: () => (this.type() === 'category' || this.selected() ? undefined : { name: this.#term() }),
    stream: ({ params }) => {
      let httpParams = new HttpParams().set('page', 1).set('perPage', PAGE_SIZE).set('isActive', true).set('sellable', true);
      if (params.name) httpParams = httpParams.set('name', params.name);
      return this.#http
        .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params: httpParams })
        .pipe(
          map(({ data }) => data.filter((product) => product.type !== 'modifier' && product.type !== 'ingredient')),
          toRemoteResult(),
        );
    },
  });

  readonly categories = rxResource({
    params: () => (this.type() === 'category' && !this.selected() ? true : undefined),
    stream: () => this.#http.get<CategoryDto[]>(`${ApiPathEnum.RESTAURANT}/categories`).pipe(map(flattenCategories), toRemoteResult()),
  });

  readonly $loading = computed(() => (this.type() === 'category' ? this.categories.isLoading() : this.products.isLoading()));
  readonly $error = computed(() => (this.type() === 'category' ? resultError(this.categories.value()) : resultError(this.products.value())));

  readonly $options = computed<Option[]>(() => {
    const type = this.type();
    if (type === 'category') {
      const term = normalize(this.#term());
      return (resultValue(this.categories.value()) ?? [])
        .filter((category) => !term || normalize(category.name).includes(term))
        .map((category) => ({ ...category, detail: null }));
    }
    const products = resultValue(this.products.value()) ?? [];
    if (type === 'product') {
      return products.map((product) => ({ id: product.id, name: product.name, detail: priceRange(product) }));
    }
    return products.flatMap((product) =>
      product.variations
        .filter((variation) => variation.isActive !== false)
        .map((variation) => {
          const label = variationLabel(variation.name);
          return {
            id: variation.id,
            name: label ? `${product.name} · ${label}` : product.name,
            detail: variation.sellPriceIncTax !== null ? formatMenuPrice(variation.sellPriceIncTax) : null,
          };
        }),
    );
  });

  pick(option: Option) {
    this.selected.set({ id: option.id, name: option.name });
    this.$search.set('');
  }

  clear() {
    this.selected.set(null);
  }
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function priceRange(product: ProductDto): string | null {
  const prices = product.variations.map((variation) => variation.sellPriceIncTax).filter((price): price is number => price !== null);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMenuPrice(min) : `${formatMenuPrice(min)} – ${formatMenuPrice(max)}`;
}
