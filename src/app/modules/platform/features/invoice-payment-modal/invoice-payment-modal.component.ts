import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/billing/data-access';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { formatClp, getPlatformErrorMessage, PlatformInvoiceDto, PlatformService, RegisterPaymentDto } from '../../data-access';
import { BUSINESS_MODAL_CONFIG } from '../business-shared';
import { InvoiceTarget, nowInSantiago, santiagoDateTimeToIso } from '../payment-shared';

export type InvoicePaymentModalData = Readonly<{ invoice: InvoiceTarget }>;

type ManualMethod = RegisterPaymentDto['method'];
const METHODS: readonly ManualMethod[] = ['transfer', 'cash', 'other'];
const MAX_REFERENCE = 100;
const MAX_COMMENT = 500;
// Tolerancia para la hora del navegador vs. la del servidor.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Registra un pago recibido por otro medio (queda confirmado). Devuelve true si se guardó. */
@Component({
  selector: 'app-invoice-payment-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Registrar pago</h2>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        <div class="rounded-md border border-[var(--border)] p-3">
          <p class="text-foreground font-medium">{{ invoice.businessName }}</p>
          <p class="text-muted-foreground text-xs">{{ invoice.label }}</p>
          <dl class="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt class="text-muted-foreground">Total</dt>
              <dd class="text-foreground font-medium tabular-nums">{{ formatClp(invoice.total) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Pagado</dt>
              <dd class="text-foreground font-medium tabular-nums">{{ formatClp(invoice.paidAmount) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Falta</dt>
              <dd class="text-foreground font-semibold tabular-nums">{{ formatClp(remaining) }}</dd>
            </div>
          </dl>
          @if (invoice.pendingAmount > 0) {
            <p class="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Hay {{ formatClp(invoice.pendingAmount) }} en transferencias por revisar. Si corresponden a este pago, confírmalas en vez de registrar otro.
            </p>
          }
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label for="payment-method" class="mb-1 block font-medium">Medio *</label>
            <select id="payment-method" class="glass-input w-full rounded-md px-3 py-2" (change)="$method.set($any($event.target).value)">
              @for (method of methods; track method) {
                <option [value]="method" [selected]="$method() === method">{{ methodLabels[method] }}</option>
              }
            </select>
          </div>
          <div>
            <label for="payment-amount" class="mb-1 block font-medium">Monto (CLP) *</label>
            <input
              id="payment-amount"
              type="number"
              inputmode="numeric"
              min="1"
              step="1"
              class="glass-input w-full rounded-md px-3 py-2 tabular-nums"
              [value]="$amount() ?? ''"
              (input)="handleAmount($event)" />
            @if ($isOverpaid()) {
              <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">Supera lo que falta pagar ({{ formatClp(remaining) }}).</p>
            }
          </div>
          <div>
            <label for="payment-date" class="mb-1 block font-medium">Fecha del pago *</label>
            <input id="payment-date" type="date" class="glass-input w-full rounded-md px-3 py-2" [max]="today" [value]="$date()" (change)="$date.set($any($event.target).value)" />
          </div>
          <div>
            <label for="payment-time" class="mb-1 block font-medium">Hora *</label>
            <input id="payment-time" type="time" class="glass-input w-full rounded-md px-3 py-2" [value]="$time()" (change)="$time.set($any($event.target).value)" />
          </div>
        </div>
        <p class="text-muted-foreground -mt-2 text-xs">Hora de Chile.</p>

        <div>
          <label for="payment-reference" class="mb-1 block font-medium">Referencia</label>
          <input
            id="payment-reference"
            type="text"
            [attr.maxlength]="maxReference"
            placeholder="Ej: N° de transferencia o boleta"
            class="glass-input w-full rounded-md px-3 py-2"
            [value]="$reference()"
            (input)="$reference.set($any($event.target).value)" />
        </div>

        <div>
          <label for="payment-comment" class="mb-1 block font-medium">Comentario</label>
          <textarea
            id="payment-comment"
            rows="2"
            [attr.maxlength]="maxComment"
            placeholder="Ej: Pagó en efectivo en la oficina"
            class="glass-input w-full rounded-md px-3 py-2"
            [value]="$comment()"
            (input)="$comment.set($any($event.target).value)"></textarea>
        </div>

        <p class="text-muted-foreground text-xs">El pago queda confirmado. Si cubre el total, el cobro queda pagado y la suscripción activa.</p>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Registrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class InvoicePaymentModalComponent {
  readonly dialogRef = inject<MatDialogRef<InvoicePaymentModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<InvoicePaymentModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly formatClp = formatClp;
  readonly methods = METHODS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly maxReference = MAX_REFERENCE;
  readonly maxComment = MAX_COMMENT;
  readonly invoice = this.data.invoice;
  readonly remaining = Math.max(0, this.invoice.total - this.invoice.paidAmount);
  readonly today = nowInSantiago().date;

  readonly $method = signal<ManualMethod>('transfer');
  readonly $amount = signal<number | null>(this.remaining || null);
  readonly $date = signal(nowInSantiago().date);
  readonly $time = signal(nowInSantiago().time);
  readonly $reference = signal('');
  readonly $comment = signal('');
  readonly $isSaving = signal(false);
  readonly $isOverpaid = computed(() => (this.$amount() ?? 0) > this.remaining);

  handleAmount(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$amount.set(value === '' ? null : Number(value));
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    const amount = this.$amount();
    if (amount === null || !Number.isInteger(amount) || amount <= 0) {
      this.#toast.show('Ingresa un monto entero mayor a 0', 'warning');
      return;
    }
    if (!this.$date() || !this.$time()) {
      this.#toast.show('Ingresa la fecha y la hora del pago', 'warning');
      return;
    }
    const paidAt = santiagoDateTimeToIso(this.$date(), this.$time());
    if (new Date(paidAt).getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      this.#toast.show('La fecha del pago no puede ser futura', 'warning');
      return;
    }

    const dto: RegisterPaymentDto = {
      method: this.$method(),
      amount,
      paidAt,
      reference: this.$reference().trim() || null,
      comment: this.$comment().trim() || null,
    };
    this.$isSaving.set(true);
    this.#platform
      .registerPayment(this.invoice.id, dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          const invoice = result as Partial<PlatformInvoiceDto> | null;
          const message =
            invoice?.status === 'paid'
              ? 'Pago registrado: el cobro quedó pagado'
              : `Pago registrado${invoice?.total !== undefined && invoice.paidAmount !== undefined ? `. Falta ${formatClp(Math.max(0, invoice.total - invoice.paidAmount))}` : ''}`;
          this.#toast.show(message, 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo registrar el pago'), 'error');
          // 409 INVOICE_NOT_PAYABLE: el cobro ya cambió; se cierra para recargar.
          if (readApiError(error).status === 409) this.dialogRef.close(true);
        },
      });
  }
}

export function openInvoicePaymentModal(dialog: MatDialog, data: InvoicePaymentModalData): Observable<boolean | undefined> {
  return dialog
    .open<InvoicePaymentModalComponent, InvoicePaymentModalData, boolean>(InvoicePaymentModalComponent, { ...BUSINESS_MODAL_CONFIG, width: '560px', data })
    .afterClosed();
}
