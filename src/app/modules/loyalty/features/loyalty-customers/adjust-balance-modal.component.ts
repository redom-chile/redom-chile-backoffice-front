import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { formatLoyaltyBalance, getLoyaltyErrorMessage, LoyaltyCustomerDto, LoyaltyService } from 'src/app/modules/loyalty/data-access';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

export type AdjustBalanceModalData = Readonly<{ customer: LoyaltyCustomerDto }>;

type Field = 'amount' | 'note';
const NOTE_MAX = 200;

export function openAdjustBalanceModal(dialog: MatDialog, data: AdjustBalanceModalData): Observable<LoyaltyCustomerDto | undefined> {
  return dialog
    .open<AdjustBalanceModalComponent, AdjustBalanceModalData, LoyaltyCustomerDto>(AdjustBalanceModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}

/** Ajuste manual del saldo (regalo, corrección). Devuelve el cliente actualizado. */
@Component({
  selector: 'app-adjust-balance-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Ajuste manual</h2>
      </ng-template>

      <form class="space-y-5 p-2" (submit)="$event.preventDefault(); save()">
        <p class="text-muted-foreground text-sm">
          {{ customer.contact.name || customer.contact.mobile }} tiene <strong class="text-foreground">{{ balance(customer.balance) }}</strong>.
        </p>

        <div>
          <span class="mb-1 block text-sm font-medium">Operación *</span>
          <div class="glass-input inline-flex gap-1 rounded-full p-1" role="radiogroup" aria-label="Operación">
            @for (option of [{ sign: 1, label: 'Sumar' }, { sign: -1, label: 'Descontar' }]; track option.sign) {
            <button
              type="button"
              role="radio"
              class="h-8 rounded-full px-4 text-sm font-medium"
              [class]="$sign() === option.sign ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
              [attr.aria-checked]="$sign() === option.sign"
              (click)="$sign.set(option.sign)">
              {{ option.label }}
            </button>
            }
          </div>
        </div>

        <div>
          <label for="adjust-amount" class="mb-1 block text-sm font-medium">Cantidad de {{ unitPlural }} *</label>
          <input
            id="adjust-amount"
            type="number"
            inputmode="numeric"
            min="1"
            max="100000"
            step="1"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="show('amount')"
            [value]="$amount() ?? ''"
            (input)="$amount.set(num($event))" />
          @if (show('amount'); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          } @else if ($result(); as result) {
          <p class="text-muted-foreground mt-1 text-xs">Queda con {{ result }}.</p>
          }
        </div>

        <div>
          <label for="adjust-note" class="mb-1 block text-sm font-medium">Motivo *</label>
          <input
            id="adjust-note"
            type="text"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="show('note')"
            [maxLength]="noteMax"
            placeholder="Regalo de cumpleaños"
            [value]="$note()"
            (input)="$note.set($any($event.target).value)" />
          @if (show('note'); as error) {
          <p class="text-destructive mt-1 text-xs">{{ error }}</p>
          }
        </div>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" tone="primary" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" tone="primary" [isLoading]="$isSaving()" (buttonClick)="save()">Guardar ajuste</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class AdjustBalanceModalComponent {
  readonly dialogRef = inject<MatDialogRef<AdjustBalanceModalComponent, LoyaltyCustomerDto>>(MatDialogRef);
  readonly #data = inject<AdjustBalanceModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(LoyaltyService);
  readonly #toast = inject(ToastService);

  readonly customer = this.#data.customer;
  readonly noteMax = NOTE_MAX;
  readonly unitPlural = this.customer.mechanic === 'stamps' ? 'sellos' : 'puntos';

  readonly $sign = signal(1);
  readonly $amount = signal<number | null>(null);
  readonly $note = signal('');
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);

  readonly $problems = computed(() => {
    const problems: Partial<Record<Field, string>> = {};
    const amount = this.$amount();
    if (amount === null || !Number.isInteger(amount) || amount < 1 || amount > 100000) problems.amount = 'Ingresa un número entero entre 1 y 100.000.';
    else if (this.$sign() < 0 && amount > this.customer.balance) problems.amount = `No puede quedar negativo: tiene ${this.balance(this.customer.balance)}.`;
    if (!this.$note().trim()) problems.note = 'Cuenta por qué ajustas el saldo.';
    return problems;
  });
  readonly $result = computed(() => {
    const amount = this.$amount();
    return amount ? this.balance(this.customer.balance + this.$sign() * amount) : null;
  });

  num(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    return raw === '' ? null : Number(raw);
  }

  balance(amount: number): string {
    return formatLoyaltyBalance(amount, this.customer.mechanic);
  }

  show(field: Field): string | null {
    return this.$submitted() ? (this.$problems()[field] ?? null) : null;
  }

  save() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (Object.keys(this.$problems()).length) return;
    this.$isSaving.set(true);
    this.#service.adjust({ contactId: this.customer.contact.id, amount: this.$sign() * this.$amount()!, note: this.$note().trim() }).subscribe({
      next: (customer) => {
        this.#toast.show(`Saldo ajustado: ahora tiene ${this.balance(customer.balance)}`, 'success');
        this.dialogRef.close(customer);
      },
      error: (error: unknown) => {
        this.$isSaving.set(false);
        const message = getLoyaltyErrorMessage(error, 'No se pudo ajustar el saldo.', { mechanic: this.customer.mechanic });
        if (message) this.#toast.show(message, 'error');
      },
    });
  }
}
