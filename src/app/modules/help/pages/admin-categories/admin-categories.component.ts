import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { getHelpErrorMessage, HelpAdminCategoryDto, HelpAdminService } from '../../data-access';
import { openAdminCategoryModal } from '../../features/admin-category-modal';
import { confirmHelpAction } from '../../features/admin-confirm';

/** Categorías del centro de ayuda (incluidas las inactivas), en el orden en que se muestran. */
@Component({
  selector: 'app-admin-categories',
  imports: [
    RouterLink,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-categories.component.html',
  styles: `
    .cdk-drag-preview {
      background: var(--card);
      border-radius: 0.75rem;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    }
    .cdk-drag-placeholder {
      opacity: 0.35;
    }
    .cdk-drag-animating,
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class AdminCategoriesComponent {
  readonly #help = inject(HelpAdminService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly categories = rxResource({
    stream: () => this.#help.getCategories(true).pipe(toRemoteResult()),
  });
  readonly $error = computed(() => resultError(this.categories.value()));
  // Copia local para reordenar de inmediato (se revierte si el backend falla).
  readonly $items = linkedSignal<HelpAdminCategoryDto[]>(() => resultValue(this.categories.value()) ?? []);
  readonly $busyId = signal<number | null>(null);
  readonly $isReordering = signal(false);

  errorMessage(error: unknown): string {
    return getHelpErrorMessage(error, 'Intenta nuevamente.');
  }

  handleCreate() {
    openAdminCategoryModal(this.#dialog).subscribe((saved) => {
      if (saved) this.categories.reload();
    });
  }

  handleEdit(category: HelpAdminCategoryDto) {
    openAdminCategoryModal(this.#dialog, { category }).subscribe((saved) => {
      if (saved) this.categories.reload();
    });
  }

  handleDrop(event: CdkDragDrop<HelpAdminCategoryDto[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const previous = this.$items();
    const next = [...previous];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.$items.set(next);
    this.$isReordering.set(true);
    this.#help
      .reorderCategories(next.map((category) => category.id))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.$isReordering.set(false);
          this.#toast.show('Orden guardado', 'success');
        },
        error: (error: unknown) => {
          this.$isReordering.set(false);
          this.$items.set(previous);
          this.#toast.show(getHelpErrorMessage(error, 'No se pudo guardar el orden'), 'error');
        },
      });
  }

  handleToggle(category: HelpAdminCategoryDto) {
    this.#setActive(category, !category.isActive);
  }

  handleDelete(category: HelpAdminCategoryDto) {
    confirmHelpAction(this.#dialog, {
      title: 'Eliminar categoría',
      message: `¿Eliminar "${category.name}"? Solo se puede si no tiene artículos.`,
      confirmText: 'Eliminar',
      cancelText: 'Volver',
      tone: 'danger',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$busyId.set(category.id);
      this.#help
        .deleteCategory(category.id)
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: () => {
            this.$busyId.set(null);
            this.#toast.show('Categoría eliminada', 'success');
            this.categories.reload();
          },
          error: (error: unknown) => {
            this.$busyId.set(null);
            this.#toast.show(getHelpErrorMessage(error, 'No se pudo eliminar la categoría'), 'error');
            if (readApiError(error).code === 'HELP_CATEGORY_NOT_EMPTY' && category.isActive) this.#offerDeactivate(category, error);
          },
        });
    });
  }

  #offerDeactivate(category: HelpAdminCategoryDto, error: unknown) {
    const count = Number(readApiError(error).details['articlesCount']) || category.articlesCount;
    confirmHelpAction(this.#dialog, {
      title: 'Desactivar categoría',
      message: `"${category.name}" tiene ${count} ${count === 1 ? 'artículo' : 'artículos'}. ¿Prefieres desactivarla? Se oculta junto a sus artículos del centro de ayuda y la puedes volver a activar cuando quieras.`,
      confirmText: 'Desactivar',
      cancelText: 'Volver',
    }).subscribe((confirmed) => {
      if (confirmed) this.#setActive(category, false);
    });
  }

  #setActive(category: HelpAdminCategoryDto, isActive: boolean) {
    if (this.$busyId()) return;
    this.$busyId.set(category.id);
    this.#help
      .updateCategory(category.id, { isActive })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.$busyId.set(null);
          this.#toast.show(isActive ? 'Categoría activada' : 'Categoría desactivada', 'success');
          this.categories.reload();
        },
        error: (error: unknown) => {
          this.$busyId.set(null);
          this.#toast.show(getHelpErrorMessage(error, 'No se pudo actualizar la categoría'), 'error');
        },
      });
  }
}
