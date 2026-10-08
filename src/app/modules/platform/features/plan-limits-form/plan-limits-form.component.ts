import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { PLAN_LIMIT_LABELS, PlanLimitCode } from 'src/app/core/services/entitlements';
import { ButtonComponent, IconComponent, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformPlanDto, PlatformService } from '../../data-access';
import { confirmPlanAction, planImpactMessage } from '../plan-shared';

const LIMIT_CODES: PlanLimitCode[] = ['max_locations', 'max_users', 'max_registers', 'ai_questions_month'];

const LIMIT_TITLES: Record<PlanLimitCode, string> = {
  max_locations: 'Locales',
  max_users: 'Usuarios',
  max_registers: 'Cajas',
  ai_questions_month: 'Preguntas al asistente por mes',
};

type LimitGroup = FormGroup<{ value: FormControl<number | null>; unlimited: FormControl<boolean> }>;

/** Pestaña "Límites": número o "Ilimitado" (null). Solo se envían los que cambian. */
@Component({
  selector: 'app-plan-limits-form',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="glass rounded-[1rem]" [formGroup]="form" (ngSubmit)="handleSave()">
      <ul class="divide-y divide-[var(--border)]">
        @for (code of codes; track code) {
        @let group = form.controls[code];
        <li class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between" [formGroup]="group">
          <div class="min-w-0">
            <label [for]="'plan-limit-' + code" class="text-foreground block text-sm font-medium">{{ titles[code] }}</label>
            <p class="text-muted-foreground text-xs">
              Actual: {{ currentLabel(code) }} · <span class="font-mono">{{ code }}</span>
            </p>
          </div>
          <div class="flex items-center gap-4">
            <input
              [id]="'plan-limit-' + code"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              formControlName="value"
              [placeholder]="group.controls.unlimited.value ? 'Ilimitado' : '0'"
              class="glass-input w-28 rounded-md px-3 py-2 text-right tabular-nums disabled:opacity-50"
              [class.border-red-500]="group.controls.value.invalid && group.controls.value.touched" />
            <label class="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" formControlName="unlimited" class="h-4 w-4 accent-[var(--primary)]" />
              Ilimitado
            </label>
          </div>
        </li>
        }
      </ul>
      <div class="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <app-icon class="h-4 w-4">bolt</app-icon>
          Los cambios aplican al instante a los negocios del plan.
        </p>
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving() || !$isDirty()" (buttonClick)="reset()">Descartar</app-button>
          <app-button type="submit" impact="bold" [disabled]="$isSaving() || !$isDirty()" [isLoading]="$isSaving()">Guardar</app-button>
        </div>
      </div>
    </form>
  `,
})
export class PlanLimitsFormComponent {
  readonly $plan = input.required<PlatformPlanDto>({ alias: 'plan' });
  readonly saved = output<PlatformPlanDto>();

  readonly #platform = inject(PlatformService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly codes = LIMIT_CODES;
  readonly titles = LIMIT_TITLES;
  readonly form = new FormGroup(
    Object.fromEntries(LIMIT_CODES.map((code) => [code, this.#limitGroup()])) as Record<PlanLimitCode, LimitGroup>,
  );
  readonly $isDirty = toSignal(this.form.valueChanges.pipe(map(() => Object.keys(this.#changes()).length > 0)), { initialValue: false });
  readonly $isSaving = signal(false);

  constructor() {
    for (const code of LIMIT_CODES) {
      const group = this.form.controls[code];
      group.controls.unlimited.valueChanges.pipe(takeUntilDestroyed()).subscribe((unlimited) => {
        const control = group.controls.value;
        if (unlimited) control.disable({ emitEvent: false });
        else {
          control.enable({ emitEvent: false });
          if (control.value === null) control.setValue(0, { emitEvent: false });
        }
        this.form.updateValueAndValidity();
      });
    }
    // Cada vez que llega el plan (al cargar o tras guardar), el formulario vuelve a sus valores.
    effect(() => {
      this.$plan();
      untracked(() => this.reset());
    });
  }

  currentLabel(code: PlanLimitCode): string {
    const limit = this.$plan().limits[code];
    if (limit === null || limit === undefined) return 'ilimitado';
    const label = PLAN_LIMIT_LABELS[code];
    return `${limit} ${limit === 1 ? label.one : label.many}`;
  }

  reset() {
    const limits = this.$plan().limits;
    for (const code of LIMIT_CODES) {
      const value = limits[code] ?? null;
      this.form.controls[code].reset({ value, unlimited: value === null });
    }
  }

  handleSave() {
    if (this.$isSaving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Los límites deben ser números enteros desde 0, o ilimitados', 'warning');
      return;
    }
    const limits = this.#changes();
    const changed = Object.keys(limits) as PlanLimitCode[];
    if (!changed.length) return;
    const plan = this.$plan();
    const summary = changed
      .map((code) => `${LIMIT_TITLES[code]}: ${limits[code] === null ? 'ilimitado' : limits[code]}`)
      .join(', ');
    confirmPlanAction(this.#dialog, {
      title: 'Guardar límites',
      message: `${planImpactMessage(plan.subscriptions)} Cambios: ${summary}.`,
      confirmText: 'Guardar',
      cancelText: 'Volver',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.$isSaving.set(true);
      this.#platform
        .setPlanLimits(plan.id, limits)
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: (updated) => {
            this.$isSaving.set(false);
            this.#toast.show('Límites guardados', 'success');
            this.saved.emit(updated);
          },
          error: (error: unknown) => {
            this.$isSaving.set(false);
            this.#toast.show(getPlatformErrorMessage(error, 'No se pudieron guardar los límites'), 'error');
          },
        });
    });
  }

  #limitGroup(): LimitGroup {
    return new FormGroup({
      value: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]),
      unlimited: new FormControl(false, { nonNullable: true }),
    });
  }

  /** Solo los límites que cambiaron (null = ilimitado). */
  #changes(): Partial<Record<PlanLimitCode, number | null>> {
    const limits = this.$plan().limits;
    const changes: Partial<Record<PlanLimitCode, number | null>> = {};
    for (const code of LIMIT_CODES) {
      const { value, unlimited } = this.form.controls[code].getRawValue();
      const next = unlimited ? null : value === null ? null : Number(value);
      if (!unlimited && (value === null || Number.isNaN(next))) continue;
      if (next !== (limits[code] ?? null)) changes[code] = next;
    }
    return changes;
  }
}
