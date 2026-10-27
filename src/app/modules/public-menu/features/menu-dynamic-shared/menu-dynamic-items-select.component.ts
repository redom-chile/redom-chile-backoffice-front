import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { IconComponent } from 'src/ui';
import { categoryName, MenuDynamicCatalog, productName } from './menu-dynamic-catalog';
import { normalizeText } from './menu-dynamic-format';

type Option = Readonly<{ id: number; name: string; detail: string | null }>;

// Resultados visibles a la vez: el resto se encuentra buscando.
const VISIBLE = 60;

/** Varios productos o categorías del catálogo, en el orden en que se eligen. Los ids van en `value`. */
@Component({
  selector: 'app-menu-dynamic-items-select',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (value().length) {
    <ul class="mb-2 flex flex-wrap gap-1.5" [attr.aria-label]="kind() === 'category' ? 'Categorías elegidas' : 'Productos elegidos'">
      @for (id of value(); track id; let index = $index) {
      <li class="bg-primary/10 text-foreground inline-flex max-w-full items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm">
        @if (numbered()) {
        <span class="text-primary text-xs font-semibold">{{ index + 1 }}.</span>
        }
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
    @if ($full()) {
    <p class="text-muted-foreground text-xs">Llegaste al máximo de {{ max() }}. Quita uno para elegir otro.</p>
    } @else {
    <div class="relative">
      <app-icon class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true">search</app-icon>
      <input
        type="search"
        [id]="inputId()"
        class="glass-input w-full rounded-md py-2 pl-9 pr-3 text-sm"
        [class.border-red-500]="invalid()"
        [placeholder]="kind() === 'category' ? 'Buscar categoría' : 'Buscar producto'"
        autocomplete="off"
        [value]="$search()"
        (input)="$search.set($any($event.target).value)" />
    </div>
    <div class="glass-row mt-1 max-h-48 overflow-y-auto rounded-md">
      @if (!catalog()) {
      <p class="text-muted-foreground p-3 text-center text-xs">{{ loading() ? 'Cargando…' : 'No se pudo cargar la lista.' }}</p>
      } @else if (!$options().length) {
      <p class="text-muted-foreground p-3 text-center text-xs">Sin resultados.</p>
      } @else {
      <ul class="divide-y divide-[var(--border)]">
        @for (option of $options(); track option.id) {
        @let checked = $selected().has(option.id);
        <li>
          <button
            type="button"
            class="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
            [attr.aria-pressed]="checked"
            (click)="toggle(option.id)">
            <span class="text-foreground min-w-0 truncate">{{ option.name }}</span>
            <span class="flex shrink-0 items-center gap-2">
              @if (option.detail) {
              <span class="text-muted-foreground text-xs">{{ option.detail }}</span>
              }
              <app-icon class="h-5 w-5" [class]="checked ? 'text-primary' : 'text-muted-foreground'" aria-hidden="true">
                {{ checked ? (single() ? 'radio_button_checked' : 'check_box') : single() ? 'radio_button_unchecked' : 'check_box_outline_blank' }}
              </app-icon>
            </span>
          </button>
        </li>
        }
      </ul>
      }
    </div>
    }
    }
  `,
})
export class MenuDynamicItemsSelectComponent {
  readonly kind = input.required<'product' | 'category'>();
  readonly catalog = input<MenuDynamicCatalog | null>(null);
  readonly loading = input(false);
  readonly value = model<number[]>([]);
  /** Máximo de elegidos (null = sin tope). Con 1 se comporta como selección única. */
  readonly max = input<number | null>(null);
  /** Ids que no se ofrecen (por ejemplo, los que gatillan la sugerencia). */
  readonly exclude = input<readonly number[]>([]);
  readonly numbered = input(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly inputId = input('');

  readonly $search = signal('');
  readonly $selected = computed(() => new Set(this.value()));
  readonly single = computed(() => this.max() === 1);
  readonly $full = computed(() => !this.single() && this.max() !== null && this.value().length >= this.max()!);

  readonly $options = computed<Option[]>(() => {
    const catalog = this.catalog();
    if (!catalog) return [];
    const term = normalizeText(this.$search().trim());
    const excluded = new Set(this.exclude());
    const all: Option[] =
      this.kind() === 'category'
        ? catalog.categories.map((category) => ({ id: category.id, name: category.name, detail: null }))
        : catalog.products.map((product) => ({ id: product.id, name: product.name, detail: product.priceLabel }));
    return all.filter((option) => !excluded.has(option.id) && (!term || normalizeText(option.name).includes(term))).slice(0, VISIBLE);
  });

  nameOf(id: number): string {
    return this.kind() === 'category' ? categoryName(this.catalog(), id) : productName(this.catalog(), id);
  }

  toggle(id: number) {
    if (this.single()) {
      this.value.set(this.value()[0] === id ? [] : [id]);
      this.$search.set('');
      return;
    }
    this.value.update((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : this.$full() ? ids : [...ids, id]));
  }
}
