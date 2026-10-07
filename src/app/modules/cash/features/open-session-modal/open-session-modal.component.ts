import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ApiErrorCode, readApiError } from 'src/app/core/utils';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CashDeviceStore, CashRegisterDto, CashService, getCashErrorMessage } from '../../data-access';
import { CashContextStore } from '../cash-panel/cash-context.store';
import { cashSessionLabel, toAmount } from '../cash-panel/cash-format';

export type OpenSessionData = Readonly<{
  // Local de las cajas a mostrar; sin él se buscan todas (p. ej. al anular un pago).
  locationId?: number | null;
  // Caja preseleccionada.
  registerId?: number | null;
  // Por qué se pide abrir (p. ej. "Para cobrar en efectivo…").
  message?: string;
}>;

// adopted: la caja ya tenía un turno abierto y se usa ese.
export type OpenSessionResult = Readonly<{ registerId: number; sessionId: number | null; adopted: boolean }>;

const QUICK_AMOUNTS = [0, 20000, 50000, 100000];

@Component({
  selector: 'app-open-session-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './open-session-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenSessionModalComponent implements OnInit {
  private readonly dialogRef = inject<MatDialogRef<OpenSessionModalComponent, OpenSessionResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cash = inject(CashService);
  private readonly device = inject(CashDeviceStore);
  private readonly context = inject(CashContextStore);
  private readonly toast = inject(ToastService);

  readonly data = inject<OpenSessionData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  readonly formatCurrency = formatCurrency;
  readonly quickAmounts = QUICK_AMOUNTS;

  readonly $registers = signal<CashRegisterDto[] | null>(null);
  readonly $loadError = signal(false);
  readonly $selectedId = signal<number | null>(null);
  readonly $isSaving = signal(false);
  readonly $selected = computed(() => this.$registers()?.find((register) => register.id === this.$selectedId()) ?? null);
  readonly $openLabel = computed(() => {
    const register = this.$selected();
    const session = register?.openSession;
    return register && session ? cashSessionLabel(register.name, session.openedByName, session.openedAt) : null;
  });

  readonly amount = new FormControl<number | null>(0);

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.$loadError.set(false);
    const locationId = this.data.locationId ?? undefined;
    this.cash
      .getRegisters(locationId ? { locationId } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (all) => {
          const target = all.find((register) => register.id === this.data.registerId);
          // Sin local: solo las cajas del local de la caja pedida.
          const registers = all.filter(
            (register) => register.isActive && (locationId || !target || register.locationId === target.locationId),
          );
          this.$registers.set(registers);
          const stored = this.device.registerFor(locationId ?? target?.locationId);
          const preferred = [this.data.registerId, stored].find((id) => registers.some((register) => register.id === id));
          this.$selectedId.set(preferred ?? registers[0]?.id ?? null);
        },
        error: () => this.$loadError.set(true),
      });
  }

  setAmount(value: number) {
    this.amount.setValue(value);
  }

  confirm() {
    const register = this.$selected();
    if (!register || this.$isSaving()) return;
    if (register.openSession) {
      this.finish(register, register.openSession.id, true);
      return;
    }
    const raw = Number(this.amount.value ?? 0);
    if (!Number.isFinite(raw) || raw < 0) {
      this.toast.show('El fondo inicial no puede ser negativo', 'warning');
      return;
    }
    this.$isSaving.set(true);
    this.cash
      .openSession({ registerId: register.id, openingAmount: toAmount(raw) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.toast.show(`${register.name} abierta`, 'success');
          this.finish(register, session.id, false);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          const api = readApiError(error);
          if (api.code === ApiErrorCode.CASH_SESSION_ALREADY_OPEN) {
            // Alguien la abrió antes: se usa ese turno.
            const sessionId = Number(api.details['sessionId']);
            this.toast.show(`${register.name} ya estaba abierta: se usa el turno en curso`, 'warning');
            this.finish(register, Number.isFinite(sessionId) && sessionId > 0 ? sessionId : null, true);
            return;
          }
          this.toast.show(getCashErrorMessage(error, 'No se pudo abrir la caja'), 'error');
        },
      });
  }

  cancel() {
    this.dialogRef.close();
  }

  // El dispositivo queda trabajando con la caja que abrió.
  private finish(register: CashRegisterDto, sessionId: number | null, adopted: boolean) {
    this.device.select(register.locationId, register.id);
    this.context.refresh();
    this.dialogRef.close({ registerId: register.id, sessionId, adopted });
  }
}

export function openCashSessionModal(dialog: MatDialog, data: OpenSessionData = {}): Observable<OpenSessionResult | undefined> {
  return dialog
    .open<OpenSessionModalComponent, OpenSessionData, OpenSessionResult>(OpenSessionModalComponent, {
      width: '460px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
