import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ApiErrorCode, readApiError } from 'src/app/core/utils/api-error';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { ExpensesService, getFinanceErrorMessage } from '../../data-access';

export type CancelExpenseModalData = Readonly<{ expenseId: number; description: string }>;

/** Anula un gasto pidiendo el motivo. Devuelve true si se anuló. Con pagos vigentes el backend responde 409. */
@Component({
  selector: 'app-cancel-expense-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Anular gasto</h2>
      </ng-template>

      <div class="space-y-3 p-2">
        <p class="text-muted-foreground text-sm">
          «{{ data.description }}» quedará anulado y dejará de contar como deuda. Si tiene pagos, primero anúlalos.
        </p>
        <div>
          <label for="cancel-expense-reason" class="mb-1 block text-sm font-medium">Motivo *</label>
          <textarea
            id="cancel-expense-reason"
            rows="3"
            maxlength="255"
            [formControl]="reason"
            placeholder="Ej: Registrado dos veces"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="reason.invalid && reason.touched"></textarea>
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="grid grid-cols-2 gap-2">
          <app-button type="button" full impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Volver</app-button>
          <app-button type="button" full impact="bold" tone="danger" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleConfirm()">
            Anular gasto
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class CancelExpenseModalComponent {
  readonly dialogRef = inject<MatDialogRef<CancelExpenseModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<CancelExpenseModalData>(MAT_DIALOG_DATA);
  readonly #expenses = inject(ExpensesService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] });
  readonly $isSaving = signal(false);

  handleConfirm() {
    if (this.$isSaving()) return;
    const reason = this.reason.value.trim();
    if (!reason) {
      this.reason.markAsTouched();
      this.#toast.show('Indica el motivo de la anulación', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.#expenses
      .cancel(this.data.expenseId, reason)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show('Gasto anulado', 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          const hasPayments = readApiError(error).code === ApiErrorCode.EXPENSE_HAS_PAYMENTS;
          this.#toast.show(
            hasPayments ? 'El gasto tiene pagos: anúlalos primero' : getFinanceErrorMessage(error, 'No se pudo anular el gasto'),
            'error',
          );
        },
      });
  }
}

export function openCancelExpenseModal(dialog: MatDialog, data: CancelExpenseModalData): Observable<boolean | undefined> {
  return dialog
    .open<CancelExpenseModalComponent, CancelExpenseModalData, boolean>(CancelExpenseModalComponent, {
      width: '460px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
