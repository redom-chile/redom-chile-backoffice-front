import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { CustomerOrderDto, CustomerOrdersService, getPublicMenuErrorMessage } from 'src/app/modules/public-menu/data-access';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

export type CustomerOrderRejectResult = Readonly<{ order?: CustomerOrderDto; alreadyResolved?: boolean }>;

const REASON_MAX = 300;
const SUGGESTIONS = ['Se acabó', 'Cocina cerrada', 'Mesa equivocada', 'Pedido duplicado'] as const;

/** Rechazar un pedido de cliente con el motivo que verá en su celular. */
@Component({
  selector: 'app-customer-order-reject-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Rechazar pedido · {{ $table }}</h2>
      </ng-template>

      <div class="space-y-3 p-2">
        <p class="text-muted-foreground text-sm">El cliente verá el motivo en su celular.</p>
        <div class="flex flex-wrap gap-2" aria-label="Sugerencias">
          @for (suggestion of suggestions; track suggestion) {
          <button
            type="button"
            class="glass-row rounded-full px-3 py-1 text-sm"
            [class.ring-2]="$reason().trim() === suggestion"
            [class.ring-primary]="$reason().trim() === suggestion"
            (click)="$reason.set(suggestion)">
            {{ suggestion }}
          </button>
          }
        </div>
        <div>
          <label for="reject-reason" class="mb-1 block text-sm font-medium">Motivo *</label>
          <textarea
            id="reject-reason"
            rows="3"
            class="glass-input w-full resize-y rounded-md px-3 py-2 text-sm"
            placeholder="Ej.: se acabó el lomo"
            [class.border-red-500]="$touched() && !!$error()"
            [value]="$reason()"
            (input)="$reason.set($any($event.target).value)"
            (blur)="$touched.set(true)"></textarea>
          <div class="mt-1 flex justify-between gap-2 text-xs">
            <span class="text-red-600 dark:text-red-400">{{ $touched() ? ($error() ?? '') : '' }}</span>
            <span class="text-muted-foreground tabular-nums">{{ $reason().trim().length }}/{{ max }}</span>
          </div>
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="danger" [isLoading]="$isSaving()" (buttonClick)="submit()">Rechazar pedido</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class CustomerOrderRejectModalComponent {
  readonly dialogRef = inject<MatDialogRef<CustomerOrderRejectModalComponent, CustomerOrderRejectResult>>(MatDialogRef);
  readonly #order = inject<CustomerOrderDto>(MAT_DIALOG_DATA);
  readonly #service = inject(CustomerOrdersService);
  readonly #toast = inject(ToastService);

  readonly suggestions = SUGGESTIONS;
  readonly max = REASON_MAX;
  readonly $table = this.#order.table?.name ?? 'Sin mesa';

  readonly $reason = signal('');
  readonly $touched = signal(false);
  readonly $isSaving = signal(false);
  readonly $error = computed(() => {
    const length = this.$reason().trim().length;
    if (!length) return 'Escribe el motivo.';
    return length > REASON_MAX ? `Máximo ${REASON_MAX} caracteres.` : null;
  });

  submit() {
    this.$touched.set(true);
    if (this.$error() || this.$isSaving()) return;
    this.$isSaving.set(true);
    this.#service.reject(this.#order.id, this.$reason().trim()).subscribe({
      next: (order) => this.dialogRef.close({ order }),
      error: (error: unknown) => {
        this.$isSaving.set(false);
        if (readApiError(error).code === 'CUSTOMER_ORDER_NOT_PENDING') {
          this.#toast.show('Otra persona ya resolvió este pedido', 'warning');
          this.dialogRef.close({ alreadyResolved: true });
          return;
        }
        this.#toast.show(getPublicMenuErrorMessage(error, 'No se pudo rechazar el pedido.'), 'error');
      },
    });
  }
}

export function openCustomerOrderRejectModal(dialog: MatDialog, order: CustomerOrderDto): Observable<CustomerOrderRejectResult | undefined> {
  return dialog
    .open<CustomerOrderRejectModalComponent, CustomerOrderDto, CustomerOrderRejectResult>(CustomerOrderRejectModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      autoFocus: false,
      data: order,
    })
    .afterClosed();
}
