import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/billing/data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { formatClp, getPlatformErrorMessage, PlatformService } from '../../data-access';
import { BUSINESS_MODAL_CONFIG } from '../business-shared';
import { PaymentTarget } from '../payment-shared';

export type PaymentReasonModalData = Readonly<{
  /** reject: rechaza una transferencia informada; reverse: reversa un pago confirmado. */
  mode: 'reject' | 'reverse';
  payment: PaymentTarget;
}>;

const MAX_REASON = 500;
const REJECT_PRESETS = ['No encontramos la transferencia', 'El monto no coincide', 'El comprobante no se puede leer'];

/** Motivo para rechazar o reversar un pago (obligatorio). Devuelve true si se guardó. */
@Component({
  selector: 'app-payment-reason-modal',
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ isReject ? 'Rechazar transferencia' : 'Reversar pago' }}</h2>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        <p class="text-muted-foreground">
          {{ methodLabels[data.payment.method] }} de <span class="text-foreground font-semibold">{{ formatClp(data.payment.amount) }}</span>
          de <span class="text-foreground font-medium">{{ data.payment.businessName }}</span>
          @if (data.payment.reference) {
            · Ref. <span class="font-mono">{{ data.payment.reference }}</span>
          }
        </p>

        @if (!isReject) {
          <div class="flex gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-700 dark:text-red-300">
            <app-icon class="h-5 w-5 shrink-0">warning</app-icon>
            <p>
              Se crea un reverso por {{ formatClp(data.payment.amount) }} (el pago no se borra). El cobro volverá a pendiente; si era el período actual, la
              suscripción quedará con pago atrasado.
            </p>
          </div>
        }

        <div>
          <label for="payment-reason" class="mb-1 block font-medium">Motivo *</label>
          <textarea
            id="payment-reason"
            rows="3"
            [attr.maxlength]="maxReason"
            [placeholder]="isReject ? 'Ej: No encontramos la transferencia en la cuenta' : 'Ej: El banco devolvió la transferencia'"
            class="glass-input w-full rounded-md px-3 py-2"
            [value]="$reason()"
            (input)="$reason.set($any($event.target).value)"></textarea>
          <div class="text-muted-foreground mt-1 flex justify-between gap-2 text-xs">
            <span>{{ isReject ? 'El dueño lo verá junto con la opción de informar de nuevo.' : 'Queda en el comentario del reverso y en el historial.' }}</span>
            <span class="tabular-nums">{{ $reason().length }}/{{ maxReason }}</span>
          </div>
          @if (isReject) {
            <div class="mt-2 flex flex-wrap gap-2">
              @for (preset of presets; track preset) {
                <button
                  type="button"
                  class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10"
                  (click)="$reason.set(preset)">
                  {{ preset }}
                </button>
              }
            </div>
          }
        </div>

        @if (!isReject) {
          <label class="flex items-start gap-2">
            <input type="checkbox" class="mt-0.5 h-4 w-4 accent-[var(--primary)]" [checked]="$understood()" (change)="$understood.set($any($event.target).checked)" />
            <span>Entiendo que el cobro volverá a quedar pendiente</span>
          </label>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="danger" [disabled]="!$canSubmit()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">
            {{ isReject ? 'Rechazar' : 'Reversar' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class PaymentReasonModalComponent {
  readonly dialogRef = inject<MatDialogRef<PaymentReasonModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<PaymentReasonModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatClp = formatClp;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly maxReason = MAX_REASON;
  readonly presets = REJECT_PRESETS;
  readonly isReject = this.data.mode === 'reject';

  readonly $reason = signal('');
  readonly $understood = signal(false);
  readonly $isSaving = signal(false);
  readonly $canSubmit = computed(() => !this.$isSaving() && !!this.$reason().trim() && (this.isReject || this.$understood()));

  handleSubmit() {
    if (!this.$canSubmit()) return;
    const reason = this.$reason().trim();
    const id = this.data.payment.id;
    this.$isSaving.set(true);
    const request$ = this.isReject ? this.#platform.rejectPayment(id, reason) : this.#platform.reversePayment(id, reason);
    request$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: () => {
        this.#toast.show(this.isReject ? 'Transferencia rechazada' : 'Pago reversado: el cobro volvió a pendiente', 'success');
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        this.#toast.show(getPlatformErrorMessage(error, this.isReject ? 'No se pudo rechazar la transferencia' : 'No se pudo reversar el pago'), 'error');
        // 409: ya fue revisado o reversado por otro; se cierra para recargar.
        if (readApiError(error).status === 409) this.dialogRef.close(true);
      },
    });
  }
}

export function openPaymentReasonModal(dialog: MatDialog, data: PaymentReasonModalData): Observable<boolean | undefined> {
  return dialog
    .open<PaymentReasonModalComponent, PaymentReasonModalData, boolean>(PaymentReasonModalComponent, { ...BUSINESS_MODAL_CONFIG, data })
    .afterClosed();
}
