import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { throttledRefresh } from 'src/app/core/services/file-upload';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import {
  GetAllCategoriesService,
  CategoryDto,
  getCategoryErrorMessage,
} from './data-access';
import {
  CategoriesTableComponent,
  CreateCategoryModalComponent,
  UpdateCategoryModalComponent,
  DeleteCategoryModalComponent,
  CategoryModalResult,
} from './features';
import { PERMISSIONS } from 'src/app/core/permissions';
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
    this.toast.show(message, 'success');
    this.getAllService.getAll();
  }

  handleRetry() {
    this.getAllService.retry();
  }
}
