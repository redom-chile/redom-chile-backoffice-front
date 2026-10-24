import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { throttledRefresh } from 'src/app/core/services/file-upload';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { BusinessSettingsService, MenuSortMode } from 'src/app/core/services/business-settings';
import { getReorderErrorMessage, MenuSortModeControlComponent, sortForMenu, takeStage8Notice } from 'src/app/modules/products/shared';
import { hasApiErrorCode } from 'src/app/core/utils/api-error';
import {
  GetAllCategoriesService,
  CategoryDto,
  getCategoryErrorMessage,
  ReorderCategoriesDto,
  ReorderCategoriesService,
} from './data-access';
import {
  CategoriesTableComponent,
  CategoriesOrderListComponent,
  CreateCategoryModalComponent,
  UpdateCategoryModalComponent,
  DeleteCategoryModalComponent,
  CategoryModalResult,
} from './features';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    CategoriesTableComponent,
    CategoriesOrderListComponent,
    MenuSortModeControlComponent,
    CheckPermissionDirective,
  ],
  templateUrl: './category-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListComponent implements OnInit {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly getAllService = inject(GetAllCategoriesService);
  // Las URLs de imagen vencen en 1 hora: se vuelve a pedir el árbol.
  protected readonly refreshExpiredImages = throttledRefresh(() => this.getAllService.getAll());

  readonly $isLoading = this.getAllService.$isLoading;
  readonly $errorMessage = computed(() => {
    const status = this.getAllService.$error();
    return status ? getCategoryErrorMessage(status) : null;
  });
  readonly $categories = this.getAllService.$categories;
  // Orden de la carta: manual (arrastrable) o alfabético (las posiciones guardadas no se tocan).
  readonly $sortMode = inject(BusinessSettingsService).$menuSortMode;
  readonly $sortedCategories = computed(() => sortTree(this.$categories() ?? [], this.$sortMode()));
  readonly #access = inject(AccessService);
  readonly $canReorder = computed(() => this.#access.can(PERMISSIONS.CATEGORIES.UPDATE_CATEGORY));
  readonly $isReordering = signal(false);
  readonly #reorderService = inject(ReorderCategoriesService);
  readonly $isEmpty = computed(
    () => !this.getAllService.$isLoading() && !this.$errorMessage() && (this.$categories()?.length ?? 0) === 0,
  );

  ngOnInit() {
    this.getAllService.getAll();
  }

  handleCreate() {
    this.dialog
      .open<CreateCategoryModalComponent, void, CategoryModalResult>(CreateCategoryModalComponent, {
        width: '600px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  handleUpdate(category: CategoryDto) {
    this.dialog
      .open<UpdateCategoryModalComponent, CategoryDto, CategoryModalResult>(UpdateCategoryModalComponent, {
        width: '600px',
        disableClose: true,
        data: category,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  handleDelete(category: CategoryDto) {
    this.dialog
      .open<DeleteCategoryModalComponent, CategoryDto, CategoryModalResult>(DeleteCategoryModalComponent, {
        width: '500px',
        disableClose: true,
        data: category,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  private handleModalResult(result: CategoryModalResult | undefined) {
    const messages: Partial<Record<CategoryModalResult, string>> = {
      created: 'Categoría creada exitosamente',
      updated: 'Categoría actualizada exitosamente',
      deleted: 'Categoría eliminada exitosamente',
    };
    const message = result ? messages[result] : undefined;
    if (!message) return;
    // Ícono sin guardar (backend sin etapa 8): se avisa una vez, en el mismo toast.
    const notice = takeStage8Notice();
    this.toast.show(notice ? `${message}. El ícono ${notice.toLowerCase()}.` : message, notice ? 'warning' : 'success');
    this.getAllService.getAll();
  }

  /** Optimista: se muestra el nuevo orden al tiro y se revierte si el servidor no lo guarda. */
  handleReorder(dto: ReorderCategoriesDto) {
    if (this.$isReordering()) return;
    const previous = this.$categories() ?? [];
    this.getAllService.setLocal(applyOrder(previous, dto));
    this.$isReordering.set(true);
    this.#reorderService.reorder(dto).subscribe({
      next: () => this.$isReordering.set(false),
      error: (error) => {
        this.$isReordering.set(false);
        this.getAllService.setLocal(previous);
        this.toast.show(getReorderErrorMessage(error), 'error');
        // Alguien creó o borró categorías mientras tanto: se trae la lista real.
        if (hasApiErrorCode(error, 'REORDER_IDS_MISMATCH')) this.getAllService.getAll();
      },
    });
  }

  handleRetry() {
    this.getAllService.retry();
  }
}

function sortTree(categories: readonly CategoryDto[], mode: MenuSortMode): CategoryDto[] {
  return sortForMenu(categories, mode).map((category) =>
    category.subcategories?.length ? { ...category, subcategories: sortForMenu(category.subcategories, mode) } : category,
  );
}

/** Asigna position = índice al grupo reordenado (principales si parentId es null). */
function applyOrder(categories: readonly CategoryDto[], { parentId, ids }: ReorderCategoriesDto): CategoryDto[] {
  const positionOf = new Map(ids.map((id, index) => [id, index]));
  const withPositions = (list: readonly CategoryDto[]) =>
    list.map((category) => (positionOf.has(category.id) ? { ...category, position: positionOf.get(category.id) } : category));
  if (parentId === null) return withPositions(categories);
  return categories.map((category) =>
    category.id === parentId ? { ...category, subcategories: withPositions(category.subcategories ?? []) } : category,
  );
}
