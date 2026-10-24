import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent, ProgressBarComponent } from 'src/ui';
import { moveInList } from 'src/app/modules/products/shared';
import { CategoryDto, ReorderCategoriesDto } from '../../data-access';
import { CategoryOrderRowComponent } from './category-order-row.component';

/** Orden manual: principales y, dentro de cada una, sus subcategorías (arrastre vertical o subir/bajar). */
@Component({
  selector: 'app-categories-order-list',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    IconComponent,
    ProgressBarComponent,
    CategoryOrderRowComponent,
  ],
  templateUrl: './categories-order-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesOrderListComponent {
  protected readonly handleClass =
    'text-muted-foreground inline-flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing';
  // Ya ordenadas (principales y subcategorías).
  readonly categories = input.required<CategoryDto[]>();
  readonly isLoading = input(false);
  readonly canReorder = input(false);
  // Guardando un orden: no se permite otro movimiento hasta que responda.
  readonly busy = input(false);
  readonly reorder = output<ReorderCategoriesDto>();
  readonly onUpdate = output<CategoryDto>();
  readonly onDelete = output<CategoryDto>();
  readonly imageExpired = output<void>();

  drop(parentId: number | null, list: readonly CategoryDto[], event: CdkDragDrop<unknown>) {
    this.#emit(parentId, list, event.previousIndex, event.currentIndex);
  }

  move(parentId: number | null, list: readonly CategoryDto[], index: number, delta: -1 | 1) {
    this.#emit(parentId, list, index, index + delta);
  }

  #emit(parentId: number | null, list: readonly CategoryDto[], from: number, to: number) {
    if (from === to || to < 0 || to >= list.length || this.busy()) return;
    // El grupo del backend son las categorías con ese padre (0 = principales): las huérfanas que el árbol muestra arriba no van.
    const group = parentId ?? 0;
    const ids = moveInList(list, from, to)
      .filter((category) => (category.parentId || 0) === group)
      .map((category) => category.id);
    this.reorder.emit({ parentId, ids });
  }
}
