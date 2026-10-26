import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { isPlanError } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective, ToastService } from 'src/ui';
import {
  CustomerInsightsService,
  invalidSegmentField,
  segmentFieldLabel,
  SEGMENT_PRIORITY_TEXT,
  SEGMENT_SETTINGS_FIELDS,
  SegmentSettingsDto,
  SegmentSettingsField,
} from 'src/app/modules/customers/data-access';

type SettingsForm = FormGroup<Record<SegmentSettingsField, FormControl<number | null>>>;

/** Ajustes de los segmentos del panel. Cierra con true si se guardó (el backend recalcula al tiro). */
@Component({
  selector: 'app-segment-settings-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-foreground text-xl font-semibold">Ajustar segmentos</h2>
      </ng-template>

      @if ($loading()) {
      <div class="space-y-3">
        @for (field of fields; track field.key) {
        <app-skeleton size="sm" />
        }
      </div>
      } @else if ($loadError()) {
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <app-icon class="text-destructive h-10 w-10" aria-hidden="true">error_outline</app-icon>
        <p class="text-foreground text-sm font-medium">No se pudieron cargar los ajustes</p>
        <app-button impact="light" tone="primary" shape="rounded" (buttonClick)="settingsResource.reload()">Reintentar</app-button>
      </div>
      } @else {
      <form [formGroup]="form" class="space-y-4" (ngSubmit)="handleSubmit()" novalidate>
        <p class="text-muted-foreground text-sm">{{ priorityText }} Al guardar se recalculan todos tus clientes.</p>
        @for (field of fields; track field.key) {
        @let control = form.controls[field.key];
        @let invalid = control.invalid && (control.touched || control.hasError('server'));
        <div>
          <label [for]="'segment-' + field.key" class="text-foreground mb-1 block text-sm font-medium">{{ field.label }}</label>
          <div class="flex items-center gap-2">
            <input
              [id]="'segment-' + field.key"
              type="number"
              inputmode="numeric"
              step="1"
              [min]="field.min"
              [max]="field.max"
              [formControlName]="field.key"
              class="glass-input w-28 rounded-md px-3 py-2 tabular-nums"
              [class.border-red-500]="invalid"
              [attr.aria-invalid]="invalid"
              [attr.aria-describedby]="'segment-' + field.key + '-hint'" />
            <span class="text-muted-foreground text-sm">{{ field.suffix }}</span>
          </div>
          <p [id]="'segment-' + field.key + '-hint'" class="mt-1 text-xs" [class]="invalid ? 'text-destructive' : 'text-muted-foreground'">
            @if (invalid && control.hasError('order')) {
            Debe ser mayor que los días de En riesgo.
            } @else if (invalid) {
            Usa un número entero entre {{ field.min }} y {{ field.max }}.
            } @else {
            {{ field.hint }}
            }
          </p>
        </div>
        }
      </form>
      }

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$saving()" (buttonClick)="dialogRef.close(false)">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$saving() || !$settings()" [isLoading]="$saving()" (buttonClick)="handleSubmit()">Guardar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class SegmentSettingsModalComponent {
  readonly dialogRef = inject<MatDialogRef<SegmentSettingsModalComponent, boolean>>(MatDialogRef);
  readonly #service = inject(CustomerInsightsService);
  readonly #toast = inject(ToastService);

  readonly fields = SEGMENT_SETTINGS_FIELDS;
  readonly priorityText = SEGMENT_PRIORITY_TEXT;

  readonly settingsResource = rxResource({ stream: () => this.#service.getSegmentSettings().pipe(toRemoteResult()) });
  readonly $settings = computed(() => resultValue(this.settingsResource.value()));
  readonly $loadError = computed(() => !!resultError(this.settingsResource.value()));
  readonly $loading = computed(() => this.settingsResource.isLoading() && !this.$settings());
  readonly $saving = signal(false);

  readonly form: SettingsForm = new FormGroup(
    Object.fromEntries(
      SEGMENT_SETTINGS_FIELDS.map((field) => [
        field.key,
        new FormControl<number | null>(null, [Validators.required, Validators.min(field.min), Validators.max(field.max), Validators.pattern(/^\d+$/)]),
      ]),
    ) as Record<SegmentSettingsField, FormControl<number | null>>,
  );

  constructor() {
    effect(() => {
      const settings = this.$settings();
      if (settings) this.form.reset(this.#pick(settings));
    });
    // lostDays > atRiskDays: se valida en el campo de Perdido.
    this.form.valueChanges.subscribe(() => this.#checkOrder());
  }

  handleSubmit() {
    const current = this.$settings();
    if (!current || this.$saving()) return;
    this.#checkOrder();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los valores marcados', 'warning');
      return;
    }
    const value = this.form.getRawValue();
    const changes: Partial<Record<SegmentSettingsField, number>> = {};
    for (const field of SEGMENT_SETTINGS_FIELDS) {
      const next = Number(value[field.key]);
      if (next !== current[field.key]) changes[field.key] = next;
    }
    if (!Object.keys(changes).length) {
      this.dialogRef.close(false);
      return;
    }
    this.$saving.set(true);
    this.#service.updateSegmentSettings(changes).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.$saving.set(false);
        if (isPlanError(error)) return;
        const field = invalidSegmentField(error);
        if (field) {
          const control = this.form.controls[field as SegmentSettingsField];
          control?.setErrors({ ...control.errors, server: true });
          control?.markAsTouched();
          this.#toast.show(`Revisa el valor de ${segmentFieldLabel(field)}.`, 'error');
          return;
        }
        this.#toast.show('No se pudieron guardar los segmentos', 'error');
      },
    });
  }

  #checkOrder() {
    const { atRiskDays, lostDays } = this.form.controls;
    const broken = atRiskDays.value !== null && lostDays.value !== null && Number(lostDays.value) <= Number(atRiskDays.value);
    const errors = { ...(lostDays.errors ?? {}) };
    if (broken) errors['order'] = true;
    else delete errors['order'];
    lostDays.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
  }

  #pick(settings: SegmentSettingsDto): Record<SegmentSettingsField, number> {
    return {
      newDays: settings.newDays,
      frequentVisits: settings.frequentVisits,
      atRiskDays: settings.atRiskDays,
      lostDays: settings.lostDays,
      vipTopPercent: settings.vipTopPercent,
    };
  }
}
