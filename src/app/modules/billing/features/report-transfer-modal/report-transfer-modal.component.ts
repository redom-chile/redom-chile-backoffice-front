import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DOCUMENT_ACCEPT, FileUploadService, getUploadErrorMessage } from 'src/app/core/services/file-upload';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { BillingService, formatClp, getBillingErrorMessage, INTERVAL_LABELS, InvoiceWithPaymentsDto } from '../../data-access';
import { invoiceReportable, invoiceTitle, nowInZone, zonedIso } from '../billing-format';

export type ReportTransferModalData = Readonly<{ invoice: InvoiceWithPaymentsDto; timeZone: string }>;

/** "Ya transferí": el dueño informa su transferencia con el comprobante. Devuelve el cobro actualizado. */
@Component({
  selector: 'app-report-transfer-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Informar transferencia</h2>
      </ng-template>

      <form class="space-y-4 p-2" [formGroup]="form" (ngSubmit)="handleSubmit()">
        <p class="text-muted-foreground text-sm">
          {{ title }} · Falta pagar <span class="text-foreground font-semibold">{{ maxLabel }}</span>
        </p>

        <div>
          <label for="transfer-amount" class="mb-1 block text-sm font-medium">Monto transferido *</label>
          <input
            id="transfer-amount"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            [max]="max"
            formControlName="amount"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="form.controls.amount.invalid && form.controls.amount.touched" />
          @if (form.controls.amount.invalid && form.controls.amount.touched) {
          <p class="text-destructive mt-1 text-xs">Ingresa un monto entero entre $1 y {{ maxLabel }}.</p>
          }
        </div>

        <div>
          <label for="transfer-reference" class="mb-1 block text-sm font-medium">Número de transferencia *</label>
          <input
            id="transfer-reference"
            type="text"
            maxlength="100"
            autocomplete="off"
            placeholder="Ej: 0012345678"
            formControlName="reference"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="form.controls.reference.invalid && form.controls.reference.touched" />
          @if (form.controls.reference.invalid && form.controls.reference.touched) {
          <p class="text-destructive mt-1 text-xs">Ingresa el número o código de la transferencia.</p>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="transfer-date" class="mb-1 block text-sm font-medium">Fecha *</label>
            <input id="transfer-date" type="date" [max]="today" formControlName="date" class="glass-input w-full rounded-md px-3 py-2" />
          </div>
          <div>
            <label for="transfer-time" class="mb-1 block text-sm font-medium">Hora *</label>
            <input id="transfer-time" type="time" formControlName="time" class="glass-input w-full rounded-md px-3 py-2" />
          </div>
        </div>

        <div>
          <span class="mb-1 block text-sm font-medium">Comprobante</span>
          <input #fileInput type="file" class="hidden" [accept]="accept" (change)="handleFile($event)" />
          @if ($uploading()) {
          <div class="glass-input rounded-md px-3 py-2">
            <div class="flex items-center justify-between gap-2 text-sm">
              <span class="text-foreground min-w-0 truncate">Subiendo {{ $fileName() }}…</span>
              <span class="text-muted-foreground tabular-nums">{{ $progress() }}%</span>
            </div>
            <div class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
              <div class="bg-primary h-full rounded-full transition-all" [style.width.%]="$progress()"></div>
            </div>
          </div>
          } @else if ($fileId()) {
          <div class="glass-input flex flex-wrap items-center gap-2 rounded-md px-3 py-2">
            <app-icon class="text-primary h-5 w-5 shrink-0" aria-hidden="true">attach_file</app-icon>
            <span class="text-foreground min-w-0 flex-1 truncate text-sm">{{ $fileName() }}</span>
            <button type="button" class="text-primary text-sm font-medium hover:underline" (click)="fileInput.click()">Cambiar</button>
            <button type="button" class="text-destructive text-sm font-medium hover:underline" (click)="handleRemove()">Quitar</button>
          </div>
          } @else {
          <button
            type="button"
            class="glass-input text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-md border-dashed px-3 py-3 text-sm"
            (click)="fileInput.click()">
            <app-icon class="h-5 w-5" aria-hidden="true">upload_file</app-icon>
            Adjuntar foto o PDF (máx. 10 MB)
          </button>
          }
          <p class="text-muted-foreground mt-1 text-xs">Con el comprobante revisamos tu pago más rápido.</p>
        </div>

        <div>
          <label for="transfer-comment" class="mb-1 block text-sm font-medium">Comentario</label>
          <textarea
            id="transfer-comment"
            rows="2"
            maxlength="500"
            placeholder="Ej: Transferencia desde Banco Estado"
            formControlName="comment"
            class="glass-input w-full resize-none rounded-md px-3 py-2"></textarea>
        </div>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving() || $uploading()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">
            Informar
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class ReportTransferModalComponent {
  readonly dialogRef = inject<MatDialogRef<ReportTransferModalComponent, InvoiceWithPaymentsDto>>(MatDialogRef);
  readonly #data = inject<ReportTransferModalData>(MAT_DIALOG_DATA);
  readonly #billing = inject(BillingService);
  readonly #upload = inject(FileUploadService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #fb = inject(FormBuilder);

  readonly accept = DOCUMENT_ACCEPT;
  readonly title = invoiceTitle(this.#data.invoice, INTERVAL_LABELS);
  readonly max = Math.max(1, invoiceReportable(this.#data.invoice));
  readonly maxLabel = formatClp(this.max);
  readonly #now = nowInZone(this.#data.timeZone);
  readonly today = this.#now.date;

  readonly form = this.#fb.nonNullable.group({
    amount: this.#fb.control<number | null>(invoiceReportable(this.#data.invoice) || null, [
      Validators.required,
      Validators.min(1),
      Validators.max(this.max),
      Validators.pattern(/^\d+$/),
    ]),
    reference: ['', [Validators.required, Validators.maxLength(100)]],
    date: [this.#now.date, Validators.required],
    time: [this.#now.time, Validators.required],
    comment: ['', Validators.maxLength(500)],
  });

  readonly $isSaving = signal(false);
  readonly $uploading = signal(false);
  readonly $fileId = signal<string | null>(null);
  readonly $fileName = signal<string | null>(null);
  readonly $progress = computed(() => this.#upload.$progress());

  async handleFile(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file || this.$uploading()) return;
    const previous = { id: this.$fileId(), name: this.$fileName() };
    this.$fileName.set(file.name);
    this.$uploading.set(true);
    try {
      const uploaded = await this.#upload.uploadDocument(file, 'billing_receipts');
      this.$fileId.set(uploaded.fileId);
    } catch (error) {
      this.$fileId.set(previous.id);
      this.$fileName.set(previous.name);
      this.#toast.show(getUploadErrorMessage(error), 'error');
    } finally {
      this.$uploading.set(false);
    }
  }

  handleRemove() {
    this.$fileId.set(null);
    this.$fileName.set(null);
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    if (this.$uploading()) {
      this.#toast.show('Espera a que termine de subir el comprobante', 'warning');
      return;
    }
    const value = this.form.getRawValue();
    const reference = value.reference.trim();
    if (!reference) this.form.controls.reference.setValue('');
    if (this.form.invalid || !reference) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa el monto, el número de transferencia y la fecha', 'warning');
      return;
    }
    const paidAt = zonedIso(value.date, value.time, this.#data.timeZone);
    if (!paidAt) {
      this.#toast.show('Revisa la fecha y la hora de la transferencia', 'warning');
      return;
    }
    if (new Date(paidAt).getTime() > Date.now() + 5 * 60 * 1000) {
      this.#toast.show('La fecha de la transferencia no puede ser futura', 'warning');
      return;
    }
    const comment = value.comment.trim();

    this.$isSaving.set(true);
    this.#billing
      .reportTransfer(this.#data.invoice.id, {
        amount: Number(value.amount),
        reference,
        paidAt,
        ...(this.$fileId() ? { receiptFileId: this.$fileId() } : {}),
        ...(comment ? { comment } : {}),
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (invoice) => {
          this.#toast.show('Recibimos tu transferencia: la revisaremos pronto', 'success');
          this.dialogRef.close(invoice);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getBillingErrorMessage(error, 'No se pudo informar la transferencia'), 'error');
        },
      });
  }
}

export function openReportTransferModal(dialog: MatDialog, data: ReportTransferModalData): Observable<InvoiceWithPaymentsDto | undefined> {
  return dialog
    .open<ReportTransferModalComponent, ReportTransferModalData, InvoiceWithPaymentsDto>(ReportTransferModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
