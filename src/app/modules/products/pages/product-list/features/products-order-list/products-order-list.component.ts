import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { hasApiErrorCode } from 'src/app/core/utils/api-error';
import { IconComponent, ImageThumbComponent, ProgressBarComponent, ToastService } from 'src/ui';
import { getReorderErrorMessage, moveInList } from 'src/app/modules/products/shared';
import { mergeGroupOrder, ProductDto, ReorderProductsService } from '../../data-access';

type Status = 'loading' | 'ready' | 'error';

/** Modo "Ordenar": todos los productos de la categoría, arrastrables (o con subir/bajar). */
@Component({
  selector: 'app-products-order-list',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, IconComponent, ImageThumbComponent, ProgressBarComponent],
  templateUrl: './products-order-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsOrderListComponent {
  readonly #service = inject(ReorderProductsService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly categoryId = input.required<number>();
  readonly categoryName = input('');
  // La categoría tiene subcategorías: sus productos se ordenan eligiendo la subcategoría.
  readonly hasSubcategories = input(false);
  readonly done = output<void>();

  protected readonly $status = signal<Status>('loading');
  protected readonly $products = signal<ProductDto[]>([]);
  // Grupo completo que valida el backend (incluye sets de modificadores e ingredientes, que no se muestran).
  #group: ProductDto[] = [];
  protected readonly $saving = signal(false);
  #load?: Subscription;

  constructor() {
    effect(() => {
      const categoryId = this.categoryId();
      untracked(() => this.load(categoryId));
    });
  }

  load(categoryId = this.categoryId()) {
    this.#load?.unsubscribe();
    this.$status.set('loading');
    this.#load = this.#service
      .getCategoryProducts(categoryId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: ({ all, visible }) => {
          this.#group = all;
          this.$products.set(visible);
          this.$status.set('ready');
        },
        error: () => this.$status.set('error'),
      });
  }

  drop(event: CdkDragDrop<unknown>) {
    this.#move(event.previousIndex, event.currentIndex);
  }

  move(index: number, delta: -1 | 1) {
    this.#move(index, index + delta);
  }

  /** Optimista: se muestra al tiro y se revierte si el servidor no lo guarda. */
  #move(from: number, to: number) {
    const previous = this.$products();
    if (from === to || to < 0 || to >= previous.length || this.$saving()) return;
    const next = moveInList(previous, from, to).map((product, position) => ({ ...product, position }));
    this.$products.set(next);
    this.$saving.set(true);
    this.#service
      .reorder({ categoryId: this.categoryId(), ids: mergeGroupOrder(this.#group, next) })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => this.$saving.set(false),
        error: (error) => {
          this.$saving.set(false);
          this.$products.set(previous);
          this.#toast.show(getReorderErrorMessage(error), 'error');
          if (hasApiErrorCode(error, 'REORDER_IDS_MISMATCH')) this.load();
        },
      });
  }
}
