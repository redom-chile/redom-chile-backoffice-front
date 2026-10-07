import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  CASH_MOVEMENT_LABELS,
  cashMovementSign,
  CashService,
  CashSessionDto,
  getCashErrorMessage,
  PAYMENT_METHOD_LABELS,
} from '../../../data-access';
import { openCashMovementModal } from '../../cash-movement-modal/cash-movement-modal.component';
import { openCloseSessionModal } from '../../close-session-modal/close-session-modal.component';
import { CashContextStore } from '../cash-context.store';
import { formatCashSince } from '../cash-format';

export type CashPanelData = Readonly<{ registerId: number; registerName: string }>;

/** Turno en curso de la caja del dispositivo: totales (solo el dueño), movimientos y cierre. */
@Component({
  selector: 'app-cash-panel-modal',
  standalone: true,
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './cash-panel-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashPanelModalComponent implements OnInit {
  private readonly dialogRef = inject<MatDialogRef<CashPanelModalComponent>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly cash = inject(CashService);
  private readonly context = inject(CashContextStore);
  private readonly toast = inject(ToastService);

  readonly data = inject<CashPanelData>(MAT_DIALOG_DATA);
  readonly formatCurrency = formatCurrency;
  readonly formatSince = formatCashSince;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly movementLabels = CASH_MOVEMENT_LABELS;
  readonly sign = cashMovementSign;

  // undefined = cargando; null = la caja ya no tiene turno abierto.
  readonly $session = signal<CashSessionDto | null | undefined>(undefined);
  readonly $loadError = signal(false);
  readonly $methods = computed(() => (this.$session()?.methods ?? []).filter((method) => method.salesCount || method.refundsCount || method.expected));
  readonly $movements = computed(() => [...(this.$session()?.movements ?? [])].reverse().slice(0, 8));

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.$loadError.set(false);
    this.cash
      .getCurrentSession(this.data.registerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ session }) => this.$session.set(session),
        error: (error: unknown) => {
          this.$loadError.set(true);
          this.toast.show(getCashErrorMessage(error, 'No se pudo cargar el turno'), 'error');
        },
      });
  }

  addMovement(type: 'cash_in' | 'cash_out') {
    const session = this.$session();
    if (!session) return;
    openCashMovementModal(this.dialog, { sessionId: session.id, type, registerName: session.registerName }).subscribe((result) => {
      if (!result) return;
      if (result === 'closed') this.context.refresh();
      this.load();
    });
  }

  closeSession() {
    const session = this.$session();
    if (!session) return;
    openCloseSessionModal(this.dialog, {
      sessionId: session.id,
      registerName: session.registerName,
      openedAt: session.openedAt,
      openedByName: session.openedByName,
    }).subscribe((report) => {
      // El modal de cierre ya navega al reporte Z.
      if (report) this.dialogRef.close();
    });
  }

  viewSession() {
    const session = this.$session();
    if (!session) return;
    this.dialogRef.close();
    this.router.navigate(['/cash/sessions', session.id]);
  }

  close() {
    this.dialogRef.close();
  }
}
