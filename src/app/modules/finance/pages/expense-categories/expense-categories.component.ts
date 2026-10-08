import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { ExpenseCategoryDto, ExpensesService, getFinanceErrorMessage } from '../../data-access';
import { openCategoryModal } from '../../features/category-modal';

/** Categorías de gasto: crear, renombrar y activar/desactivar (las inactivas no se ofrecen en gastos nuevos). */
@Component({
  selector: 'app-expense-categories',
  imports: [RouterLink, HeaderDashboardComponent, ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header-dashboard title="Categorías de gasto" subtitle="Ordena tus gastos para saber en qué se va la plata.">
      <div class="flex items-center gap-3">
        <a routerLink="/finance/expenses" class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium">
          <app-icon class="h-5 w-5">arrow_back</app-icon>
          <span class="hidden sm:inline">Gastos</span>
        </a>
        <button
          type="button"
          class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          (click)="handleCreate()">
          <app-icon class="h-5 w-5">add</app-icon>
          <span class="hidden sm:inline">Nueva categoría</span>
          <span class="sm:hidden">Nueva</span>
        </button>
      </div>
    </app-header-dashboard>

    <label class="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" class="accent-[var(--primary)] h-4 w-4" [checked]="$includeInactive()" (change)="$includeInactive.set(!$includeInactive())" />
      Incluir inactivas
    </label>

    <div class="glass overflow-hidden rounded-[1rem]">
      @if (categories.isLoading() && !$categories()) {
      <div class="divide-y divide-[var(--border)]">
        @for (row of [1, 2, 3, 4]; track row) {
        <div class="px-4 py-4"><app-skeleton size="xs" style="width: 180px" /></div>
        }
      </div>
      } @else if ($error()) {
      <div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <p class="text-foreground font-medium">No se pudieron cargar las categorías</p>
        <app-button type="button" impact="bold" (buttonClick)="categories.reload()">Reintentar</app-button>
      </div>
      } @else if (!$categories()?.length) {
      <p class="text-muted-foreground px-4 py-12 text-center text-sm">No hay categorías.</p>
      } @else {
      <ul class="divide-y divide-[var(--border)]">
        @for (category of $categories(); track category.id) {
        <li class="flex flex-wrap items-center gap-3 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="text-foreground truncate font-medium" [class.text-muted-foreground]="!category.isActive">{{ category.name }}</p>
            @if (!category.isActive) {
            <p class="text-muted-foreground text-xs">Inactiva: no se ofrece en gastos nuevos</p>
            }
          </div>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium"
            [class]="category.isActive ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-[var(--muted)] text-muted-foreground'">
            {{ category.isActive ? 'Activa' : 'Inactiva' }}
          </span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="text-muted-foreground hover:text-primary inline-flex h-9 w-9 items-center justify-center rounded-md"
              [attr.aria-label]="'Renombrar ' + category.name"
              title="Renombrar"
              (click)="handleRename(category)">
              <app-icon class="h-5 w-5">edit</app-icon>
            </button>
            <button
              type="button"
              class="text-primary rounded-md px-2 py-1 text-sm font-medium hover:underline disabled:opacity-50"
              [disabled]="$busyId() === category.id"
              (click)="handleToggle(category)">
              {{ category.isActive ? 'Desactivar' : 'Activar' }}
            </button>
          </div>
        </li>
        }
      </ul>
      }
    </div>
  `,
})
export class ExpenseCategoriesComponent {
  readonly #expenses = inject(ExpensesService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly $includeInactive = signal(true);
  readonly $busyId = signal<number | null>(null);

  readonly categories = rxResource({
    params: () => ({ includeInactive: this.$includeInactive() }),
    stream: ({ params }) => this.#expenses.getCategories(params.includeInactive).pipe(toRemoteResult()),
  });
  readonly $categories = computed(() => resultValue(this.categories.value()));
  readonly $error = computed(() => resultError(this.categories.value()));

  handleCreate() {
    openCategoryModal(this.#dialog).subscribe((saved) => {
      if (saved) this.categories.reload();
    });
  }

  handleRename(category: ExpenseCategoryDto) {
    openCategoryModal(this.#dialog, { category }).subscribe((saved) => {
      if (saved) this.categories.reload();
    });
  }

  handleToggle(category: ExpenseCategoryDto) {
    if (this.$busyId()) return;
    this.$busyId.set(category.id);
    const isActive = !category.isActive;
    this.#expenses
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
          this.#toast.show(getFinanceErrorMessage(error, 'No se pudo actualizar la categoría'), 'error');
        },
      });
  }
}
