import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { ExpenseCategoryDto, ExpensesService, getFinanceErrorMessage } from '../../data-access';

// Sin categoría: crear; con categoría: renombrar.
export type CategoryModalData = Readonly<{ category?: ExpenseCategoryDto }>;

/** Crear o renombrar una categoría de gasto. Devuelve la categoría guardada (undefined = cancelado). */
@Component({
  selector: 'app-expense-category-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ category ? 'Renombrar categoría' : 'Nueva categoría' }}</h2>
      </ng-template>

      <form class="p-2" (ngSubmit)="handleSubmit()">
        <label for="category-name" class="mb-1 block text-sm font-medium">Nombre *</label>
        <input
          id="category-name"
          type="text"
          maxlength="100"
          [formControl]="name"
          placeholder="Ej: Publicidad"
          class="glass-input w-full rounded-md px-3 py-2"
          [class.border-red-500]="name.invalid && name.touched" />
        @if (name.invalid && name.touched) {
        <p class="text-destructive mt-1 text-xs">Ingresa el nombre.</p>
        }
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">
            {{ category ? 'Guardar' : 'Crear' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class CategoryModalComponent {
  readonly dialogRef = inject<MatDialogRef<CategoryModalComponent, ExpenseCategoryDto>>(MatDialogRef);
  readonly #data = inject<CategoryModalData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly #expenses = inject(ExpensesService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly category = this.#data?.category ?? null;
  readonly name = new FormControl(this.category?.name ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  readonly $isSaving = signal(false);

  handleSubmit() {
    if (this.$isSaving()) return;
    const name = this.name.value.trim();
    if (!name) {
      this.name.markAsTouched();
      this.#toast.show('Ingresa el nombre de la categoría', 'warning');
      return;
    }
    const category = this.category;
    if (category && name === category.name) {
      this.dialogRef.close();
      return;
    }
    const request: Observable<ExpenseCategoryDto> = category
      ? this.#expenses.updateCategory(category.id, { name }).pipe(map(() => ({ ...category, name })))
      : this.#expenses.createCategory({ name }).pipe(map(({ id }) => ({ id, name, isActive: true })));

    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (saved) => {
        this.#toast.show(category ? 'Categoría renombrada' : 'Categoría creada', 'success');
        this.dialogRef.close(saved);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getFinanceErrorMessage(error, 'No se pudo guardar la categoría'), 'error');
      },
    });
  }
}

export function openCategoryModal(dialog: MatDialog, data: CategoryModalData = {}): Observable<ExpenseCategoryDto | undefined> {
  return dialog
    .open<CategoryModalComponent, CategoryModalData, ExpenseCategoryDto>(CategoryModalComponent, {
      width: '440px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
