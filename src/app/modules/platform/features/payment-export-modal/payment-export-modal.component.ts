import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformService } from '../../data-access';
import { BUSINESS_MODAL_CONFIG } from '../business-shared';
import { daysInRange, downloadBlob, nowInSantiago } from '../payment-shared';

const MAX_DAYS = 366;

/** Exporta los pagos y reversos de un rango a CSV (para contabilidad). Devuelve true si descargó. */
@Component({
  selector: 'app-payment-export-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Exportar pagos</h2>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        <p class="text-muted-foreground">
          CSV con los pagos y reversos (los reversos restan) por fecha de pago, en hora de Chile. Se abre bien en Excel. Máximo {{ maxDays }} días.
        </p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label for="export-from" class="mb-1 block font-medium">Desde *</label>
            <input id="export-from" type="date" class="glass-input w-full rounded-md px-3 py-2" [max]="$to() || today" [value]="$from()" (change)="$from.set($any($event.target).value)" />
          </div>
          <div>
            <label for="export-to" class="mb-1 block font-medium">Hasta *</label>
            <input id="export-to" type="date" class="glass-input w-full rounded-md px-3 py-2" [min]="$from()" [value]="$to()" (change)="$to.set($any($event.target).value)" />
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10" (click)="setThisMonth()">
            Este mes
          </button>
          <button type="button" class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10" (click)="setLastMonth()">
            Mes anterior
          </button>
          <button type="button" class="text-foreground rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition hover:bg-primary/10" (click)="setThisYear()">
            Este año
          </button>
        </div>
        @if ($days() > 0) {
          <p class="text-xs" [class]="$days() > maxDays ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'">{{ $days() }} {{ $days() === 1 ? 'día' : 'días' }}</p>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isLoading()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isLoading()" [isLoading]="$isLoading()" (buttonClick)="handleSubmit()">Descargar CSV</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class PaymentExportModalComponent {
  readonly dialogRef = inject<MatDialogRef<PaymentExportModalComponent, boolean>>(MatDialogRef);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly maxDays = MAX_DAYS;
  readonly today = nowInSantiago().date;

  readonly $from = signal(`${this.today.slice(0, 7)}-01`);
  readonly $to = signal(this.today);
  readonly $isLoading = signal(false);
  readonly $days = computed(() => (this.$from() && this.$to() && this.$from() <= this.$to() ? daysInRange(this.$from(), this.$to()) : 0));

  setThisMonth() {
    this.$from.set(`${this.today.slice(0, 7)}-01`);
    this.$to.set(this.today);
  }

  setLastMonth() {
    const [year, month] = this.today.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 2, 1));
    const last = new Date(Date.UTC(year, month - 1, 0));
    this.$from.set(first.toISOString().slice(0, 10));
    this.$to.set(last.toISOString().slice(0, 10));
  }

  setThisYear() {
    this.$from.set(`${this.today.slice(0, 4)}-01-01`);
    this.$to.set(this.today);
  }

  handleSubmit() {
    if (this.$isLoading()) return;
    const from = this.$from();
    const to = this.$to();
    if (!from || !to) {
      this.#toast.show('Elige las fechas desde y hasta', 'warning');
      return;
    }
    if (from > to) {
      this.#toast.show('La fecha desde debe ser anterior o igual a la fecha hasta', 'warning');
      return;
    }
    if (daysInRange(from, to) > MAX_DAYS) {
      this.#toast.show(`El rango no puede superar ${MAX_DAYS} días`, 'warning');
      return;
    }
    this.$isLoading.set(true);
    this.#platform
      .exportPayments({ from, to })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (blob) => {
          downloadBlob(blob, `pagos-redom-${from}-a-${to}.csv`);
          this.#toast.show('Exportación descargada', 'success');
          this.dialogRef.close(true);
        },
        error: async (error: unknown) => {
          this.$isLoading.set(false);
          this.#toast.show(getPlatformErrorMessage(await readBlobError(error), 'No se pudo exportar los pagos'), 'error');
        },
      });
  }
}

/** Con responseType blob, el error JSON del backend llega como Blob: se lee para traducir el código. */
async function readBlobError(error: unknown): Promise<unknown> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) return error;
  try {
    const body: unknown = JSON.parse(await error.error.text());
    return new HttpErrorResponse({ error: body, headers: error.headers, status: error.status, statusText: error.statusText, url: error.url ?? undefined });
  } catch {
    return error;
  }
}

export function openPaymentExportModal(dialog: MatDialog): Observable<boolean | undefined> {
  return dialog.open<PaymentExportModalComponent, void, boolean>(PaymentExportModalComponent, { ...BUSINESS_MODAL_CONFIG }).afterClosed();
}
