import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { map, of, switchMap } from 'rxjs';
import { ButtonComponent, ToastService } from 'src/ui';
import { formatPlatformDate, getPlatformErrorMessage, PlatformPlanDto, PlatformService, SavePlanDto } from '../../data-access';
import { confirmPlanAction, PLAN_FLAG_FIELDS, subscriptionsLabel } from '../plan-shared';

/** Pestaña "Datos": nombre, descripción y switches (el código no cambia). */
@Component({
  selector: 'app-plan-data-form',
  imports: [ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let plan = $plan();
    <form class="glass space-y-5 rounded-[1rem] p-4 sm:p-6" [formGroup]="form" (ngSubmit)="handleSubmit()">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="plan-data-code" class="mb-1 block text-sm font-medium">Código</label>
          <input
            id="plan-data-code"
            type="text"
            [value]="plan.code"
            readonly
            class="glass-input text-muted-foreground w-full cursor-not-allowed rounded-md px-3 py-2 font-mono text-sm" />
          <p class="text-muted-foreground mt-1 text-xs">No se puede cambiar.</p>
        </div>
        <div>
          <label for="plan-data-name" class="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            id="plan-data-name"
            type="text"
            maxlength="100"
            formControlName="name"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="form.controls.name.invalid && form.controls.name.touched" />
          @if (form.controls.name.invalid && form.controls.name.touched) {
          <p class="text-destructive mt-1 text-xs">Ingresa el nombre (máximo 100 caracteres).</p>
          }
        </div>
      </div>

      <div>
        <label for="plan-data-description" class="mb-1 block text-sm font-medium">Descripción</label>
        <textarea
          id="plan-data-description"
          rows="3"
          maxlength="500"
          formControlName="description"
          class="glass-input w-full resize-y rounded-md px-3 py-2"></textarea>
        <p class="text-muted-foreground mt-1 text-right text-xs tabular-nums">{{ $description().length }}/500</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        @for (flag of flags; track flag.key) {
        <label class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5">
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

      <div class="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground text-xs">Creado el {{ formatDate(plan.createdAt) }} · Actualizado el {{ formatDate(plan.updatedAt, true) }}</p>
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving() || !$isDirty()" (buttonClick)="reset()">Descartar</app-button>
          <app-button type="submit" impact="bold" [disabled]="$isSaving() || !$isDirty()" [isLoading]="$isSaving()">Guardar</app-button>
        </div>
      </div>
    </form>
  `,
})
export class PlanDataFormComponent {
  readonly $plan = input.required<PlatformPlanDto>({ alias: 'plan' });
  readonly saved = output<PlatformPlanDto>();

  readonly #fb = inject(FormBuilder);
  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly flags = PLAN_FLAG_FIELDS;
  readonly formatDate = formatPlatformDate;
  readonly form = this.#fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    isActive: [true],
    isPublic: [true],
    isHighlighted: [false],
    isFree: [false],
  });
  readonly $description = toSignal(this.form.controls.description.valueChanges, { initialValue: '' });
  readonly $isDirty = toSignal(this.form.valueChanges.pipe(map(() => Object.keys(this.#changes()).length > 0)), { initialValue: false });
  readonly $isSaving = signal(false);

  constructor() {
    // Cada vez que llega el plan (al cargar o tras guardar), el formulario vuelve a sus valores.
    effect(() => {
      this.$plan();
      untracked(() => this.reset());
    });
  }

  reset() {
    const plan = this.$plan();
    this.form.reset({
      name: plan.name,
      description: plan.description ?? '',
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      isHighlighted: plan.isHighlighted,
      isFree: plan.isFree,
    });
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Ingresa el nombre del plan', 'warning');
      return;
    }
    const changes = this.#changes();
    if (!Object.keys(changes).length) return;
    const plan = this.$plan();

    const confirmation =
      changes.isActive === false
        ? confirmPlanAction(this.#dialog, {
            title: 'Desactivar plan',
            message: `"${plan.name}" dejará de ofrecerse. Solo se puede si no tiene suscripciones vigentes (hoy tiene ${subscriptionsLabel(plan.subscriptions)}) y no es el plan de prueba ni el de respaldo.`,
            confirmText: 'Desactivar',
            cancelText: 'Volver',
            tone: 'danger',
          })
        : of(true);

    confirmation
      .pipe(
        switchMap((confirmed) => {
          if (!confirmed) return of(null);
          this.$isSaving.set(true);
          return this.#platform.updatePlan(plan.id, changes);
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: (updated) => {
          if (!updated) return;
          this.$isSaving.set(false);
          this.#toast.show('Plan actualizado', 'success');
          this.saved.emit(updated);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo actualizar el plan'), 'error');
        },
      });
  }

  /** Solo los campos que cambiaron. */
  #changes(): Omit<SavePlanDto, 'code'> {
    const plan = this.$plan();
    const value = this.form.getRawValue();
    const changes: { -readonly [K in keyof Omit<SavePlanDto, 'code'>]: Omit<SavePlanDto, 'code'>[K] } = {};
    const name = value.name.trim();
    const description = value.description.trim() || null;
    if (name !== plan.name) changes.name = name;
    if (description !== (plan.description ?? null)) changes.description = description;
    for (const flag of this.flags) {
      if (value[flag.key] !== plan[flag.key]) changes[flag.key] = value[flag.key];
    }
    return changes;
  }
}
