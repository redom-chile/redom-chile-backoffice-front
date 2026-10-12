import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  endOfDayInSantiago,
  formatPlatformDate,
  getPlatformErrorMessage,
  PlatformService,
  SubscriptionDetailDto,
  toSantiagoDateInput,
  UpdateSubscriptionDto,
} from '../../data-access';
import { addDays, BUSINESS_MODAL_CONFIG, BusinessModalData, todayInSantiago } from '../business-shared';

export type BusinessDateModalData = BusinessModalData &
  Readonly<{
    /** trial: fin de la prueba; period: fin del período actual. */
    mode: 'trial' | 'period';
    subscription: SubscriptionDetailDto;
  }>;

const PRESETS = [7, 15, 30];

/** Extender (o acortar) la prueba o el período. Devuelve true si guardó. */
@Component({
  selector: 'app-business-date-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ isTrial ? 'Extender prueba' : 'Extender período' }}</h2>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        <p class="text-muted-foreground">
          {{ isTrial ? 'Fin actual de la prueba:' : 'Fin actual del período:' }}
          <span class="text-foreground font-medium">{{ formatDate(current) }}</span>.
          @if (!isTrial && data.subscription.currentPeriodStart) {
            Empezó el {{ formatDate(data.subscription.currentPeriodStart) }}.
          }
        </p>

        <div>
          <label for="business-date" class="mb-1 block font-medium">{{ isTrial ? 'Nueva fecha de término de la prueba *' : 'Nueva fecha de término del período *' }}</label>
          <input id="business-date" type="date" class="glass-input w-full rounded-md px-3 py-2" [min]="$min()" [value]="$date()" (change)="handleDate($event)" />
          <div class="mt-2 flex flex-wrap gap-2">
            @for (days of presets; track days) {
              <button type="button" class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10" (click)="handlePreset(days)">
                +{{ days }} días
              </button>
            }
          </div>
          <p class="text-muted-foreground mt-1 text-xs">Termina al final de ese día (hora de Chile).</p>
        </div>

        @if (isTrial && data.subscription.status !== 'trialing') {
          <label class="flex items-start gap-2">
            <input type="checkbox" class="mt-0.5 h-4 w-4 accent-[var(--primary)]" [checked]="$setTrialing()" (change)="$setTrialing.set($any($event.target).checked)" />
            <span>
              Dejarla <strong>en prueba</strong> hasta esa fecha
              <span class="text-muted-foreground block text-xs">Si no, solo cambia la fecha y la suscripción sigue con su estado actual.</span>
            </span>
          </label>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving() || !$date()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Guardar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class BusinessDateModalComponent {
  readonly dialogRef = inject<MatDialogRef<BusinessDateModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<BusinessDateModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatDate = formatPlatformDate;
  readonly presets = PRESETS;
  readonly isTrial = this.data.mode === 'trial';
  readonly current = this.isTrial ? this.data.subscription.trialEndsAt : this.data.subscription.currentPeriodEnd;

  readonly $date = signal(toSantiagoDateInput(this.current));
  readonly $setTrialing = signal(true);
  readonly $isSaving = signal(false);
  // Una prueba vigente debe terminar en el futuro; el período, después de su inicio (lo valida el backend).
  readonly $min = computed(() => (this.isTrial && (this.data.subscription.status === 'trialing' || this.$setTrialing()) ? todayInSantiago() : ''));

  handleDate(event: Event) {
    this.$date.set((event.target as HTMLInputElement).value);
  }

  /** Suma días desde la fecha actual de término (o desde hoy si ya pasó). */
  handlePreset(days: number) {
    const today = todayInSantiago();
    const base = toSantiagoDateInput(this.current);
    this.$date.set(addDays(base && base > today ? base : today, days));
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    const date = this.$date();
    if (!date) {
      this.#toast.show('Elige una fecha', 'warning');
      return;
    }
    const iso = endOfDayInSantiago(date);
    const willBeTrialing = this.isTrial && (this.data.subscription.status === 'trialing' || this.$setTrialing());
    if (willBeTrialing && new Date(iso).getTime() <= Date.now()) {
      this.#toast.show('Una prueba vigente debe terminar en una fecha futura', 'warning');
      return;
    }
    const start = this.data.subscription.currentPeriodStart;
    if (!this.isTrial && start && new Date(iso).getTime() <= new Date(start).getTime()) {
      this.#toast.show('El período debe terminar después de su inicio', 'warning');
      return;
    }
    if (iso === this.current && !(willBeTrialing && this.data.subscription.status !== 'trialing')) {
      this.dialogRef.close(false);
      return;
    }

    const dto: UpdateSubscriptionDto = this.isTrial
      ? { trialEndsAt: iso, ...(willBeTrialing && this.data.subscription.status !== 'trialing' ? { status: 'trialing' as const } : {}) }
      : { currentPeriodEnd: iso };
    this.$isSaving.set(true);
    this.#platform
      .updateSubscription(this.data.businessId, dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show(`${this.isTrial ? 'Prueba' : 'Período'} hasta el ${formatPlatformDate(iso)}`, 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo cambiar la fecha'), 'error');
        },
      });
  }
}

export function openBusinessDateModal(dialog: MatDialog, data: BusinessDateModalData): Observable<boolean | undefined> {
  return dialog.open<BusinessDateModalComponent, BusinessDateModalData, boolean>(BusinessDateModalComponent, { ...BUSINESS_MODAL_CONFIG, data }).afterClosed();
}
