import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getHelpErrorMessage, HELP_SLUG_PATTERN, HelpAdminCategoryDto, HelpAdminService, SaveHelpCategoryDto } from '../../data-access';

// Sin categoría: crear; con categoría: editar.
export type AdminCategoryModalData = Readonly<{ category?: HelpAdminCategoryDto }>;

/** Crear o editar una categoría del centro de ayuda. Devuelve true si se guardó. */
@Component({
  selector: 'app-admin-category-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ category ? 'Editar categoría' : 'Nueva categoría' }}</h2>
      </ng-template>

      <form class="space-y-4 p-2" [formGroup]="form" (ngSubmit)="handleSubmit()">
        <div>
          <label for="help-category-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="help-category-name"
            type="text"
            maxlength="100"
            formControlName="name"
            placeholder="Ej: Caja y turnos"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="invalid('name')" />
          @if (invalid('name')) {
          <p class="text-destructive mt-1 text-xs">Ingresa el nombre (máximo 100 caracteres).</p>
          }
        </div>

        <div>
          <label for="help-category-slug" class="mb-1 block text-sm font-medium">Identificador (slug)</label>
          <input
            id="help-category-slug"
            type="text"
            maxlength="120"
            formControlName="slug"
            placeholder="caja-y-turnos"
            autocapitalize="off"
            spellcheck="false"
            class="glass-input w-full rounded-md px-3 py-2 font-mono text-sm"
            [class.border-red-500]="invalid('slug')" />
          @if (invalid('slug')) {
          <p class="text-destructive mt-1 text-xs">Solo minúsculas sin tildes, números y guiones (ej: caja-y-turnos), de 2 a 120 caracteres.</p>
          } @else {
          <p class="text-muted-foreground mt-1 text-xs">
            {{ category ? 'Si lo cambias, los enlaces que usen el anterior dejan de funcionar.' : 'Se genera desde el nombre si lo dejas vacío.' }}
          </p>
          }
        </div>

        <div>
          <label for="help-category-description" class="mb-1 block text-sm font-medium">Descripción</label>
          <textarea
            id="help-category-description"
            rows="2"
            maxlength="300"
            formControlName="description"
            placeholder="Ej: Abrir y cerrar caja, retiros y arqueos."
            class="glass-input w-full resize-y rounded-md px-3 py-2"></textarea>
          <p class="text-muted-foreground mt-1 text-right text-xs tabular-nums">{{ $value().description.length }}/300</p>
        </div>

        <div>
          <label for="help-category-icon" class="mb-1 block text-sm font-medium">Ícono</label>
          <div class="flex items-center gap-3">
            <span class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
              <app-icon class="h-6 w-6">{{ $value().icon.trim() || 'help' }}</app-icon>
            </span>
            <input
              id="help-category-icon"
              type="text"
              maxlength="50"
              formControlName="icon"
              placeholder="point_of_sale"
              autocapitalize="off"
              spellcheck="false"
              class="glass-input min-w-0 flex-1 rounded-md px-3 py-2 font-mono text-sm" />
          </div>
          <p class="text-muted-foreground mt-1 text-xs">
            Nombre de un ícono de
            <a href="https://fonts.google.com/icons" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Material Icons</a>
            (ej: payments, inventory_2).
          </p>
        </div>

        @if (category) {
        <label class="flex cursor-pointer items-center justify-between gap-3">
          <span>
            <span class="text-foreground block text-sm font-medium">Activa</span>
            <span class="text-muted-foreground block text-xs">Inactiva: se ocultan la categoría y sus artículos del centro de ayuda.</span>
          </span>
          <input type="checkbox" role="switch" formControlName="isActive" class="peer sr-only" />
          <span
            class="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 dark:bg-gray-600"
            aria-hidden="true"></span>
        </label>
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
export class AdminCategoryModalComponent {
  readonly dialogRef = inject<MatDialogRef<AdminCategoryModalComponent, boolean>>(MatDialogRef);
  readonly #data = inject<AdminCategoryModalData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly #fb = inject(FormBuilder);
  readonly #help = inject(HelpAdminService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly category = this.#data?.category ?? null;

  readonly form = this.#fb.nonNullable.group({
    name: [this.category?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    slug: [
      this.category?.slug ?? '',
      [Validators.minLength(2), Validators.maxLength(120), Validators.pattern(HELP_SLUG_PATTERN)],
    ],
    description: [this.category?.description ?? '', Validators.maxLength(300)],
    icon: [this.category?.icon ?? '', Validators.maxLength(50)],
    isActive: [this.category?.isActive ?? true],
  });
  readonly $value = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), { initialValue: this.form.getRawValue() });
  readonly $isSaving = signal(false);
  readonly #submitted = signal(false);

  invalid(name: 'name' | 'slug'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.#submitted());
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.#submitted.set(true);
    const value = this.form.getRawValue();
    const name = value.name.trim();
    if (!name) this.form.controls.name.setErrors({ required: true });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    const slug = value.slug.trim();
    const description = value.description.trim() || null;
    const icon = value.icon.trim() || null;
    const category = this.category;

    let request: Observable<unknown>;
    if (category) {
      // Solo lo que cambió; el slug no se puede dejar vacío al editar.
      const dto: SaveHelpCategoryDto = {
        ...(name !== category.name ? { name } : {}),
        ...(slug && slug !== category.slug ? { slug } : {}),
        ...(description !== (category.description ?? null) ? { description } : {}),
        ...(icon !== (category.icon ?? null) ? { icon } : {}),
        ...(value.isActive !== category.isActive ? { isActive: value.isActive } : {}),
      };
      if (!Object.keys(dto).length) {
        this.dialogRef.close();
        return;
      }
      request = this.#help.updateCategory(category.id, dto);
    } else {
      request = this.#help.createCategory({
        name,
        ...(slug ? { slug } : {}),
        ...(description ? { description } : {}),
        ...(icon ? { icon } : {}),
      });
    }

    this.$isSaving.set(true);
    request.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: () => {
        this.#toast.show(category ? 'Categoría actualizada' : 'Categoría creada', 'success');
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getHelpErrorMessage(error, 'No se pudo guardar la categoría'), 'error');
      },
    });
  }
}

export function openAdminCategoryModal(dialog: MatDialog, data: AdminCategoryModalData = {}): Observable<boolean | undefined> {
  return dialog
    .open<AdminCategoryModalComponent, AdminCategoryModalData, boolean>(AdminCategoryModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
