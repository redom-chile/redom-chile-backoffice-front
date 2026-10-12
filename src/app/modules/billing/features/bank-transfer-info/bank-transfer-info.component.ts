import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IconComponent, ToastService } from 'src/ui';
import { BankTransferInfoDto } from '../../data-access';

const FIELDS: ReadonlyArray<Readonly<{ key: keyof BankTransferInfoDto; label: string }>> = [
  { key: 'bank', label: 'Banco' },
  { key: 'accountType', label: 'Tipo de cuenta' },
  { key: 'accountNumber', label: 'Número de cuenta' },
  { key: 'holderName', label: 'Titular' },
  { key: 'holderTaxId', label: 'RUT' },
  { key: 'email', label: 'Correo' },
];

/** Datos para transferir a Redom, con "Copiar" en cada campo. */
@Component({
  selector: 'app-bank-transfer-info',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-[var(--border)] p-3">
      <p class="text-foreground mb-2 flex items-center gap-2 text-sm font-semibold">
        <app-icon class="text-primary h-5 w-5" aria-hidden="true">account_balance</app-icon>
        Datos para transferir
      </p>
      @if ($rows().length) {
      <dl class="divide-y divide-[var(--border)] text-sm">
        @for (row of $rows(); track row.key) {
        <div class="flex items-center gap-2 py-1.5">
          <dt class="text-muted-foreground w-32 shrink-0 text-xs sm:w-36 sm:text-sm">{{ row.label }}</dt>
          <dd class="text-foreground min-w-0 flex-1 font-medium break-words">{{ row.value }}</dd>
          <button
            type="button"
            class="text-primary hover:bg-primary/10 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
            [attr.aria-label]="'Copiar ' + row.label"
            (click)="copy(row.label, row.value)">
            <app-icon class="h-4 w-4" aria-hidden="true">content_copy</app-icon>
            Copiar
          </button>
        </div>
        }
      </dl>
      @if (amount(); as amount) {
      <div class="mt-2 flex items-center gap-2 border-t border-[var(--border)] pt-2 text-sm">
        <span class="text-muted-foreground w-32 shrink-0 text-xs sm:w-36 sm:text-sm">Monto</span>
        <span class="text-foreground min-w-0 flex-1 font-semibold">{{ amountLabel() }}</span>
        <button
          type="button"
          class="text-primary hover:bg-primary/10 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
          aria-label="Copiar monto"
          (click)="copy('Monto', '' + amount)">
          <app-icon class="h-4 w-4" aria-hidden="true">content_copy</app-icon>
          Copiar
        </button>
      </div>
      }
      } @else {
      <p class="text-muted-foreground text-sm">Todavía no publicamos los datos bancarios. Escríbenos y te los enviamos.</p>
      }
    </div>
  `,
})
export class BankTransferInfoComponent {
  readonly #toast = inject(ToastService);

  readonly info = input.required<BankTransferInfoDto | null>();
  /** Monto a transferir (opcional): se copia sin formato. */
  readonly amount = input<number | null>(null);
  readonly amountLabel = input<string>('');

  readonly $rows = computed(() => {
    const info = this.info();
    if (!info) return [];
    return FIELDS.map(({ key, label }) => ({ key, label, value: info[key]?.trim() ?? '' })).filter((row) => row.value);
  });

  async copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      this.#toast.show(`Copiado: ${label}`, 'success');
    } catch {
      this.#toast.show('No se pudo copiar. Selecciónalo y cópialo a mano.', 'error');
    }
  }
}
