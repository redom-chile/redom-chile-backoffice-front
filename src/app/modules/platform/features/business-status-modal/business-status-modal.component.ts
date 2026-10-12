import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { SubscriptionStatus } from 'src/app/core/services/entitlements';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformService, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES, SubscriptionDetailDto } from '../../data-access';
import { BUSINESS_MODAL_CONFIG, BusinessModalData } from '../business-shared';

export type BusinessStatusModalData = BusinessModalData & Readonly<{ subscription: SubscriptionDetailDto }>;

type StatusOption = Readonly<{ value: SubscriptionStatus; hint: string; disabledHint?: string }>;

/** Cambiar el estado de la suscripción a mano. Devuelve true si guardó. */
@Component({
  selector: 'app-business-status-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Cambiar estado</h2>
      </ng-template>

      <fieldset class="space-y-2 p-2 text-sm">
        <legend class="sr-only">Estado de la suscripción</legend>
        @for (option of options; track option.value) {
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition"
            [class]="$status() === option.value ? 'border-primary bg-primary/5' : 'border-[var(--border)]'"
            [class.opacity-50]="!!option.disabledHint"
            [class.cursor-not-allowed]="!!option.disabledHint">
            <input
              type="radio"
              name="subscription-status"
              class="mt-1 accent-[var(--primary)]"
              [value]="option.value"
              [checked]="$status() === option.value"
              [disabled]="!!option.disabledHint"
              (change)="$status.set(option.value)" />
            <span class="min-w-0">
              <span class="flex flex-wrap items-center gap-2">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="tones[option.value]">{{ labels[option.value] }}</span>
                @if (option.value === data.subscription.status) {
                  <span class="text-muted-foreground text-xs">(actual)</span>
                }
              </span>
              <span class="text-muted-foreground mt-1 block text-xs">{{ option.disabledHint ?? option.hint }}</span>
            </span>
          </label>
        }
      </fieldset>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button
            type="button"
            impact="bold"
            [tone]="$status() === 'expired' || $status() === 'cancelled' ? 'danger' : 'primary'"
            [disabled]="$isSaving() || $status() === data.subscription.status"
            [isLoading]="$isSaving()"
            (buttonClick)="handleSubmit()">
            Cambiar a {{ labels[$status()].toLowerCase() }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class BusinessStatusModalComponent {
  readonly dialogRef = inject<MatDialogRef<BusinessStatusModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<BusinessStatusModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly labels = SUBSCRIPTION_STATUS_LABELS;
  readonly tones = SUBSCRIPTION_STATUS_TONES;
  readonly #trialIsFuture = !!this.data.subscription.trialEndsAt && new Date(this.data.subscription.trialEndsAt).getTime() > Date.now();

  readonly options: StatusOption[] = [
    {
      value: 'trialing',
      hint: 'Vuelve a la prueba hasta su fecha de término actual.',
      disabledHint: this.#trialIsFuture ? undefined : 'Necesita una fecha de término futura: usa "Extender prueba".',
    },
    {
      value: 'active',
      hint: this.data.subscription.price
        ? 'Pagando. Si no tiene período, se crea uno desde hoy según el intervalo de su precio.'
        : 'Pagando. Sin precio no se crea un período: asígnale uno con "Cambiar plan".',
    },
    { value: 'past_due', hint: 'Pago atrasado: empieza la gracia con los días de los ajustes (si no tenía). Sigue usando su plan.' },
    { value: 'expired', hint: 'Vencida: pierde el plan y pasa al plan de respaldo. Borra la gracia.' },
    { value: 'cancelled', hint: 'Cancelada: deja de usar el plan y pasa al plan de respaldo. Borra la gracia.' },
  ];

  readonly $status = signal<SubscriptionStatus>(this.data.subscription.status);
  readonly $isSaving = signal(false);

  handleSubmit() {
    const status = this.$status();
    if (this.$isSaving() || status === this.data.subscription.status) return;
    this.$isSaving.set(true);
    this.#platform
      .updateSubscription(this.data.businessId, { status })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show(`Estado cambiado a ${SUBSCRIPTION_STATUS_LABELS[status].toLowerCase()}`, 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo cambiar el estado'), 'error');
        },
      });
  }
}

export function openBusinessStatusModal(dialog: MatDialog, data: BusinessStatusModalData): Observable<boolean | undefined> {
  return dialog.open<BusinessStatusModalComponent, BusinessStatusModalData, boolean>(BusinessStatusModalComponent, { ...BUSINESS_MODAL_CONFIG, data }).afterClosed();
}
