import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ApiErrorCode, readApiError } from 'src/app/core/utils';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CashService, getCashErrorMessage } from '../../data-access';
import { toAmount } from '../cash-panel/cash-format';

export type CashMovementData = Readonly<{ sessionId: number; type: 'cash_in' | 'cash_out'; registerName: string }>;
// closed: el turno se cerró entretanto.
export type CashMovementResult = 'saved' | 'closed';

const REASONS: Record<CashMovementData['type'], string[]> = {
  cash_in: ['Sencillo para vuelto', 'Reposición de fondo'],
  // Sin "Pago a proveedor": los pagos de gastos y cuentas por pagar en efectivo ya salen solos de la caja.
  cash_out: ['Retiro a caja fuerte', 'Depósito bancario'],
};

@Component({
  selector: 'app-cash-movement-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  templateUrl: './cash-movement-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashMovementModalComponent {
  private readonly dialogRef = inject<MatDialogRef<CashMovementModalComponent, CashMovementResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cash = inject(CashService);
  private readonly toast = inject(ToastService);

  readonly data = inject<CashMovementData>(MAT_DIALOG_DATA);
  readonly isIn = this.data.type === 'cash_in';
  readonly reasons = REASONS[this.data.type];
  readonly $isSaving = signal(false);

  readonly amount = new FormControl<number | null>(null, [Validators.required, Validators.min(1)]);
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] });

  confirm() {
    if (this.$isSaving()) return;
    const amount = toAmount(this.amount.value);
    const reason = this.reason.value.trim();
    if (amount <= 0) {
      this.amount.markAsTouched();
      this.toast.show('Ingresa un monto mayor a cero', 'warning');
      return;
    }
    if (!reason) {
      this.reason.markAsTouched();
      this.toast.show('Indica el motivo', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.cash
      .addMovement(this.data.sessionId, { type: this.data.type, amount, reason })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const verb = this.isIn ? 'Ingreso' : 'Retiro';
          this.toast.show(`${verb} de ${formatCurrency(amount)} registrado`, 'success');
          this.dialogRef.close('saved');
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.toast.show(getCashErrorMessage(error, 'No se pudo registrar el movimiento'), 'error');
          if (readApiError(error).code === ApiErrorCode.CASH_SESSION_CLOSED) this.dialogRef.close('closed');
        },
      });
  }

  cancel() {
    this.dialogRef.close();
  }
}

export function openCashMovementModal(dialog: MatDialog, data: CashMovementData): Observable<CashMovementResult | undefined> {
  return dialog
    .open<CashMovementModalComponent, CashMovementData, CashMovementResult>(CashMovementModalComponent, {
      width: '440px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
