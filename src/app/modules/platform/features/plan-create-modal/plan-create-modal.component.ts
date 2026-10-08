import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformPlanDto, PlatformService } from '../../data-access';
import { PLAN_CODE_PATTERN, PLAN_FLAG_FIELDS } from '../plan-shared';

/** Crear un plan. Devuelve el plan creado (undefined = cancelado). */
@Component({
  selector: 'app-plan-create-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Nuevo plan</h2>
      </ng-template>

      <form class="space-y-4 p-2" [formGroup]="form" (ngSubmit)="handleSubmit()">
        <div>
          <label for="plan-create-code" class="mb-1 block text-sm font-medium">Código *</label>
          <input
            id="plan-create-code"
            type="text"
            maxlength="40"
            formControlName="code"
            placeholder="pro-plus"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
            class="glass-input w-full rounded-md px-3 py-2 font-mono text-sm"
            [class.border-red-500]="invalid('code')" />
          @if (invalid('code')) {
          <p class="text-destructive mt-1 text-xs">Solo minúsculas sin tildes y números, unidos por guiones (ej: pro-plus).</p>
          } @else {
          <p class="text-muted-foreground mt-1 text-xs">No se puede cambiar después.</p>
          }
        </div>

        <div>
          <label for="plan-create-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="plan-create-name"
            type="text"
            maxlength="100"
            formControlName="name"
            placeholder="Ej: Pro Plus"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="invalid('name')" />
          @if (invalid('name')) {
          <p class="text-destructive mt-1 text-xs">Ingresa el nombre (máximo 100 caracteres).</p>
          }
        </div>

        <div>
          <label for="plan-create-description" class="mb-1 block text-sm font-medium">Descripción</label>
          <textarea
            id="plan-create-description"
            rows="2"
            maxlength="500"
            formControlName="description"
            placeholder="Ej: Para restaurantes con varios locales."
            class="glass-input w-full resize-y rounded-md px-3 py-2"></textarea>
          <p class="text-muted-foreground mt-1 text-right text-xs tabular-nums">{{ $description().length }}/500</p>
        </div>

        <div class="space-y-3">
          @for (flag of flags; track flag.key) {
          <label class="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span class="text-foreground block text-sm font-medium">{{ flag.label }}</span>
              <span class="text-muted-foreground block text-xs">{{ flag.hint }}</span>
            </span>
            <input type="checkbox" role="switch" [formControlName]="flag.key" class="peer sr-only" />
            <span
              class="relative h-6 w-11 shrink-0 rounded-full bg-gray-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[var(--primary)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 dark:bg-gray-600"
              aria-hidden="true"></span>
          </label>
          }
        </div>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Crear</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class PlanCreateModalComponent {
  readonly dialogRef = inject<MatDialogRef<PlanCreateModalComponent, PlatformPlanDto>>(MatDialogRef);
  readonly #fb = inject(FormBuilder);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly flags = PLAN_FLAG_FIELDS;
  readonly form = this.#fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(PLAN_CODE_PATTERN)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    isActive: [true],
    isPublic: [true],
    isHighlighted: [false],
    isFree: [false],
  });
  readonly $description = toSignal(this.form.controls.description.valueChanges, { initialValue: '' });
  readonly $isSaving = signal(false);
  readonly #submitted = signal(false);

  invalid(name: 'code' | 'name'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.#submitted());
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    const value = this.form.getRawValue();
    this.form.patchValue({ code: value.code.trim().toLowerCase(), name: value.name.trim() });
    this.#submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa el código y el nombre del plan', 'warning');
      return;
    }
    const { code, name, description, ...flags } = this.form.getRawValue();
    this.$isSaving.set(true);
    this.#platform
      .createPlan({ code, name, description: description.trim() || null, ...flags })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (plan) => {
          this.#toast.show('Plan creado. Ahora configura sus funciones, límites y precios.', 'success');
          this.dialogRef.close(plan);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo crear el plan'), 'error');
        },
      });
  }
}

export function openPlanCreateModal(dialog: MatDialog): Observable<PlatformPlanDto | undefined> {
  return dialog
    .open<PlanCreateModalComponent, void, PlatformPlanDto>(PlanCreateModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      disableClose: true,
    })
    .afterClosed()
    .pipe(map((plan) => plan ?? undefined));
}
