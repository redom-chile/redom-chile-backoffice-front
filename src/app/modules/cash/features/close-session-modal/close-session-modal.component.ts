import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  IconComponent,
  ModalCardComponent,
  SlotDirective,
  ToastService,
} from 'src/ui';
import {
  CashCountInputDto,
  CashService,
  CashSessionDto,
  CLP_DENOMINATIONS,
  getCashErrorMessage,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
} from '../../data-access';
import { CashContextStore } from '../cash-panel/cash-context.store';
import { formatCashSince, toAmount } from '../cash-panel/cash-format';

export type CloseSessionData = Readonly<{
  sessionId: number;
  registerName: string;
  openedAt: string;
  openedByName: string | null;
}>;

type OtherMethod = Extract<PaymentMethod, 'debit' | 'credit' | 'transfer'>;
const OTHER_METHODS: readonly OtherMethod[] = ['debit', 'credit', 'transfer'];

/** Cierre ciego: se cuenta sin ver lo esperado. Al cerrar abre el reporte Z. */
@Component({
  selector: 'app-close-session-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './close-session-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseSessionModalComponent {
  private readonly dialogRef = inject<MatDialogRef<CloseSessionModalComponent, CashSessionDto>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly cash = inject(CashService);
  private readonly context = inject(CashContextStore);
  private readonly toast = inject(ToastService);

  readonly data = inject<CloseSessionData>(MAT_DIALOG_DATA);
  readonly denominations = CLP_DENOMINATIONS;
  readonly otherMethods = OTHER_METHODS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly formatCurrency = formatCurrency;
  readonly since = formatCashSince(this.data.openedAt);

  // valor del billete/moneda → cantidad.
  readonly $quantities = signal<Readonly<Record<number, number>>>({});
  // null = no se informa ese medio.
  readonly $others = signal<Readonly<Record<OtherMethod, number | null>>>({ debit: null, credit: null, transfer: null });
  readonly $notes = signal('');
  readonly $isSaving = signal(false);

  readonly $cashTotal = computed(() =>
    Object.entries(this.$quantities()).reduce((sum, [value, quantity]) => sum + Number(value) * quantity, 0),
  );

  quantityOf(value: number): number {
    return this.$quantities()[value] ?? 0;
  }

  setQuantity(value: number, raw: unknown) {
    const quantity = toAmount(raw);
    this.$quantities.update((current) => ({ ...current, [value]: quantity }));
  }

  step(value: number, delta: number) {
    this.setQuantity(value, Math.max(0, this.quantityOf(value) + delta));
  }

  setOther(method: OtherMethod, raw: string | number | null) {
    const empty = raw === null || raw === '';
    this.$others.update((current) => ({ ...current, [method]: empty ? null : toAmount(raw) }));
  }

  confirm() {
    if (this.$isSaving()) return;
    if (this.$notes().length > 1000) {
      this.toast.show('Las notas no pueden superar los 1.000 caracteres', 'warning');
      return;
    }
    const total = this.$cashTotal();
    const message = total
      ? `Efectivo contado: ${formatCurrency(total)}. Una vez cerrada no se puede modificar el conteo.`
      : 'No contaste efectivo: se cerrará con $0 en caja. Una vez cerrada no se puede modificar el conteo.';
    this.dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: { title: `¿Cerrar ${this.data.registerName}?`, message, confirmText: 'Cerrar caja', cancelText: 'Volver' },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.close();
      });
  }

  cancel() {
    this.dialogRef.close();
  }

  private close() {
    this.$isSaving.set(true);
    const denominations = this.denominations
      .map((value) => ({ value, quantity: this.quantityOf(value) }))
      .filter((item) => item.quantity > 0);
    const others = this.$others();
    const counts: CashCountInputDto[] = [
      { method: 'cash', counted: this.$cashTotal(), ...(denominations.length ? { denominations } : {}) },
      ...this.otherMethods
        .filter((method) => others[method] !== null)
        .map((method) => ({ method, counted: others[method] as number })),
    ];
    const notes = this.$notes().trim();
    this.cash
      .closeSession(this.data.sessionId, { counts, notes: notes || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.toast.show(`${this.data.registerName} cerrada`, 'success');
          this.context.refresh();
          this.dialogRef.close(report);
          this.router.navigate(['/cash/sessions', report.id]);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.toast.show(getCashErrorMessage(error, 'No se pudo cerrar la caja'), 'error');
          // Si otro dispositivo ya la cerró, el indicador se actualiza.
          this.context.refresh();
        },
      });
  }
}

export function openCloseSessionModal(dialog: MatDialog, data: CloseSessionData): Observable<CashSessionDto | undefined> {
  return dialog
    .open<CloseSessionModalComponent, CloseSessionData, CashSessionDto>(CloseSessionModalComponent, {
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '95vh',
      disableClose: true,
      data,
    })
    .afterClosed();
}
