import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { EntitlementsDto, PLAN_FEATURES, PlanFeatureCode, PlanLimitCode } from 'src/app/core/services/entitlements';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CreateOverrideDto, endOfDayInSantiago, formatPlatformDate, getPlatformErrorMessage, PlatformService } from '../../data-access';
import { addDays, BUSINESS_MODAL_CONFIG, BusinessModalData, featureLabel, limitLabel, todayInSantiago } from '../business-shared';

export type BusinessOverrideModalData = BusinessModalData & Readonly<{ entitlements: EntitlementsDto }>;

const LIMITS: readonly PlanLimitCode[] = ['max_locations', 'max_users', 'max_registers', 'ai_questions_month'];
const PRESETS = [30, 60, 90];
const MAX_REASON = 300;

/** Agregar una excepción: una función fuera del plan y/o un límite distinto, con o sin término. Devuelve true si guardó. */
@Component({
  selector: 'app-business-override-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Agregar excepción</h2>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        <p class="text-muted-foreground">Una función fuera del plan y/o un límite distinto solo para {{ data.businessName }}. Elige al menos una de las dos.</p>

        <div>
          <label for="override-feature" class="mb-1 block font-medium">Función</label>
          <select id="override-feature" class="glass-input w-full rounded-md px-3 py-2" (change)="$feature.set($any($event.target).value || null)">
            <option value="" [selected]="!$feature()">Ninguna</option>
            @for (code of features; track code) {
              <option [value]="code" [selected]="$feature() === code">{{ featureLabel(code) }}{{ hasFeature(code) ? ' (ya la tiene)' : '' }}</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label for="override-limit" class="mb-1 block font-medium">Límite</label>
            <select id="override-limit" class="glass-input w-full rounded-md px-3 py-2" (change)="$limit.set($any($event.target).value || null)">
              <option value="" [selected]="!$limit()">Ninguno</option>
              @for (code of limits; track code) {
                <option [value]="code" [selected]="$limit() === code">{{ limitLabel(code) }}</option>
              }
            </select>
            @if ($limit(); as limit) {
              <p class="text-muted-foreground mt-1 text-xs">Hoy: {{ currentLimit(limit) }} · usa {{ data.entitlements.usage[limit] }}</p>
            }
          </div>
          @if ($limit()) {
            <div>
              <label for="override-limit-value" class="mb-1 block font-medium">Nuevo límite *</label>
              <input
                id="override-limit-value"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                class="glass-input w-full rounded-md px-3 py-2 disabled:opacity-50"
                [disabled]="$unlimited()"
                [value]="$limitValue()"
                (input)="$limitValue.set($any($event.target).value)" />
              <label class="mt-2 flex items-center gap-2">
                <input type="checkbox" class="h-4 w-4 accent-[var(--primary)]" [checked]="$unlimited()" (change)="$unlimited.set($any($event.target).checked)" />
                Ilimitado
              </label>
            </div>
          }
        </div>

        <div>
          <label for="override-reason" class="mb-1 block font-medium">Motivo *</label>
          <textarea
            id="override-reason"
            rows="2"
            [attr.maxlength]="maxReason"
            placeholder="Ej: Inventario gratis por 2 meses"
            class="glass-input w-full rounded-md px-3 py-2"
            [value]="$reason()"
            (input)="$reason.set($any($event.target).value)"></textarea>
        </div>

        <div>
          <label for="override-expires" class="mb-1 block font-medium">Termina</label>
          <input id="override-expires" type="date" class="glass-input w-full rounded-md px-3 py-2" [min]="today" [value]="$expires()" (change)="$expires.set($any($event.target).value)" />
          <div class="mt-2 flex flex-wrap gap-2">
            @for (days of presets; track days) {
              <button type="button" class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10" (click)="$expires.set(addDays(today, days))">
                {{ days }} días
              </button>
            }
            <button type="button" class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10" (click)="$expires.set('')">
              Sin término
            </button>
          </div>
          <p class="text-muted-foreground mt-1 text-xs">
            {{ $expires() ? 'Termina al final del ' + formatDate(endOfDay($expires())) + ' (hora de Chile).' : 'Sin término: dura hasta que la termines.' }}
          </p>
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Agregar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class BusinessOverrideModalComponent {
  readonly dialogRef = inject<MatDialogRef<BusinessOverrideModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<BusinessOverrideModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly features = PLAN_FEATURES;
  readonly limits = LIMITS;
  readonly presets = PRESETS;
  readonly maxReason = MAX_REASON;
  readonly today = todayInSantiago();
  readonly featureLabel = featureLabel;
  readonly limitLabel = limitLabel;
  readonly formatDate = formatPlatformDate;
  readonly endOfDay = endOfDayInSantiago;
  readonly addDays = addDays;

  readonly $feature = signal<PlanFeatureCode | null>(null);
  readonly $limit = signal<PlanLimitCode | null>(null);
  readonly $limitValue = signal('');
  readonly $unlimited = signal(false);
  readonly $reason = signal('');
  readonly $expires = signal('');
  readonly $isSaving = signal(false);
  readonly #hasFeature = computed(() => new Set(this.data.entitlements.features));

  hasFeature(code: PlanFeatureCode) {
    return this.#hasFeature().has(code);
  }

  currentLimit(code: PlanLimitCode) {
    const value = this.data.entitlements.limits[code];
    return value === null ? 'ilimitado' : String(value);
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    const featureCode = this.$feature();
    const limitCode = this.$limit();
    const reason = this.$reason().trim();
    if (!featureCode && !limitCode) {
      this.#toast.show('Elige una función, un límite o ambos', 'warning');
      return;
    }
    let limitValue: number | null | undefined;
    if (limitCode) {
      const raw = this.$limitValue().trim();
      const value = Number(raw);
      if (!this.$unlimited() && (!raw || !Number.isInteger(value) || value < 0)) {
        this.#toast.show('Ingresa el nuevo límite (un número entero) o marca "Ilimitado"', 'warning');
        return;
      }
      limitValue = this.$unlimited() ? null : value;
    }
    if (!reason) {
      this.#toast.show('Ingresa el motivo de la excepción', 'warning');
      return;
    }
    const expiresAt = this.$expires() ? endOfDayInSantiago(this.$expires()) : null;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      this.#toast.show('La fecha de término debe ser futura', 'warning');
      return;
    }

    const dto: CreateOverrideDto = {
      ...(featureCode ? { featureCode } : {}),
      ...(limitCode ? { limitCode, limitValue } : {}),
      reason,
      expiresAt,
    };
    this.$isSaving.set(true);
    this.#platform
      .createOverride(this.data.businessId, dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show('Excepción agregada', 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo agregar la excepción'), 'error');
        },
      });
  }
}

export function openBusinessOverrideModal(dialog: MatDialog, data: BusinessOverrideModalData): Observable<boolean | undefined> {
  return dialog
    .open<BusinessOverrideModalComponent, BusinessOverrideModalData, boolean>(BusinessOverrideModalComponent, { ...BUSINESS_MODAL_CONFIG, data })
    .afterClosed();
}
