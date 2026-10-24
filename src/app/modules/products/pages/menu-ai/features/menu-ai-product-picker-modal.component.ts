import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { debounceTime, Observable } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective } from 'src/ui';
import { MenuAiService } from '../data-access';

export type PickedProduct = Readonly<{ id: number; name: string; description: string | null }>;
export type MenuAiProductPickerData = Readonly<{ title: string; max: number; confirmText: string }>;

const PER_PAGE = 20;

/** Elige hasta `max` productos de la carta (con búsqueda y páginas). */
@Component({
  selector: 'app-menu-ai-product-picker-modal',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ data.title }}</h2>
      </ng-template>

      <div class="space-y-3 p-2">
        <div>
          <label for="menu-ai-picker-search" class="sr-only">Buscar producto</label>
          <input
            id="menu-ai-picker-search"
            type="search"
            class="glass-input w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            placeholder="Buscar producto"
            autocomplete="off"
            [value]="$search()"
            (input)="onSearch($event)" />
        </div>
        <p class="text-muted-foreground text-xs" aria-live="polite">
          {{ $selected().size }} de {{ data.max }} elegidos
        </p>

        @if (products.isLoading() && !$items().length) {
        <div class="flex flex-col gap-2" aria-busy="true">
          @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="bg-muted h-12 animate-pulse rounded-lg"></div>
          }
        </div>
        } @else if ($error()) {
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">No se pudieron cargar los productos.</p>
        } @else if (!$items().length) {
        <p class="text-muted-foreground py-6 text-center text-sm">No hay productos con ese nombre.</p>
        } @else {
        <ul class="flex flex-col gap-1" [class.opacity-60]="products.isLoading()">
          @for (product of $items(); track product.id) {
          @let checked = $selected().has(product.id);
          <li>
            <label class="glass-row flex cursor-pointer items-start gap-3 rounded-lg p-3" [class.opacity-50]="!checked && $full()">
              <input
                type="checkbox"
                class="accent-primary mt-0.5 h-4 w-4 shrink-0"
                [checked]="checked"
                [disabled]="!checked && $full()"
                (change)="toggle(product)" />
              <span class="min-w-0">
                <span class="text-foreground block text-sm font-medium">{{ product.name }}</span>
                <span class="text-muted-foreground block truncate text-xs">{{ product.description || 'Sin descripción' }}</span>
              </span>
            </label>
          </li>
          }
        </ul>
        @if ($totalPages() > 1) {
        <div class="flex items-center justify-between gap-2 text-sm">
          <button type="button" class="text-primary inline-flex items-center gap-1 font-medium disabled:opacity-40" [disabled]="$page() <= 1" (click)="$page.set($page() - 1)">
            <app-icon class="h-4 w-4" aria-hidden="true">chevron_left</app-icon>Anterior
          </button>
          <span class="text-muted-foreground tabular-nums">{{ $page() }} / {{ $totalPages() }}</span>
          <button type="button" class="text-primary inline-flex items-center gap-1 font-medium disabled:opacity-40" [disabled]="$page() >= $totalPages()" (click)="$page.set($page() + 1)">
            Siguiente<app-icon class="h-4 w-4" aria-hidden="true">chevron_right</app-icon>
          </button>
        </div>
        }
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex flex-wrap justify-end gap-2">
          <app-button impact="light" tone="primary" type="button" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button impact="bold" tone="primary" type="button" icon="auto_awesome" [disabled]="!$selected().size" (buttonClick)="confirm()">
            {{ data.confirmText }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class MenuAiProductPickerModalComponent {
  readonly #service = inject(MenuAiService);
  readonly dialogRef = inject<MatDialogRef<MenuAiProductPickerModalComponent, PickedProduct[]>>(MatDialogRef);
  readonly data = inject<MenuAiProductPickerData>(MAT_DIALOG_DATA);

  readonly $search = signal('');
  readonly #debounced = toSignal(toObservable(this.$search).pipe(debounceTime(300)), { initialValue: '' });
  readonly $page = signal(1);
  readonly $selected = signal<ReadonlyMap<number, PickedProduct>>(new Map());
  readonly $full = computed(() => this.$selected().size >= this.data.max);

  readonly products = rxResource({
    params: () => ({ page: this.$page(), perPage: PER_PAGE, name: this.#debounced().trim() || undefined }),
    stream: ({ params }) => this.#service.searchProducts(params).pipe(toRemoteResult()),
  });
  readonly $items = computed(() =>
    (resultValue(this.products.value())?.data ?? []).map((product) => ({ id: product.id, name: product.name, description: product.productDescription })),
  );
  readonly $totalPages = computed(() => resultValue(this.products.value())?.pagination.totalPages ?? 1);
  readonly $error = computed(() => resultError(this.products.value()));

  onSearch(event: Event) {
    this.$search.set((event.target as HTMLInputElement).value);
    this.$page.set(1);
  }

  toggle(product: PickedProduct) {
    this.$selected.update((selected) => {
      const next = new Map(selected);
      if (next.has(product.id)) next.delete(product.id);
      else if (next.size < this.data.max) next.set(product.id, product);
      return next;
    });
  }

  confirm() {
    this.dialogRef.close([...this.$selected().values()]);
  }
}

export function openMenuAiProductPicker(dialog: MatDialog, data: MenuAiProductPickerData): Observable<PickedProduct[] | undefined> {
  return dialog
    .open<MenuAiProductPickerModalComponent, MenuAiProductPickerData, PickedProduct[]>(MenuAiProductPickerModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      autoFocus: false,
      data,
    })
    .afterClosed();
}
