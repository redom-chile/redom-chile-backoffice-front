import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { readApiError } from 'src/app/core/utils/api-error';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import {
  formatClp,
  formatLoyaltyBalance,
  getLoyaltyErrorMessage,
  LoyaltyCustomerDto,
  LoyaltyRedeemResultDto,
  LoyaltyService,
  REWARD_TYPE_ICONS,
  rewardValueLabel,
} from 'src/app/modules/loyalty/data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective, ToastService } from 'src/ui';

export type LoyaltyRedeemModalData = Readonly<{ transactionId: number; contactId: number; customerName: string | null }>;

type Reward = LoyaltyCustomerDto['rewards'][number];

export function openLoyaltyRedeemModal(dialog: MatDialog, data: LoyaltyRedeemModalData): Observable<LoyaltyRedeemResultDto | undefined> {
  return dialog
    .open<LoyaltyRedeemModalComponent, LoyaltyRedeemModalData, LoyaltyRedeemResultDto>(LoyaltyRedeemModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      data,
    })
    .afterClosed();
}

/** Canje en la caja: saldo del cliente de la venta y sus recompensas. Devuelve el canje (undefined = cancelado). */
@Component({
  selector: 'app-loyalty-redeem-modal',
  imports: [ButtonComponent, IconComponent, ModalCardComponent, SkeletonComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Fidelización</h2>
      </ng-template>

      <div class="space-y-4 p-2">
        @if ($customer(); as customer) {
        <div class="glass-row flex items-center justify-between gap-3 rounded-lg p-3">
          <div class="min-w-0">
            <p class="text-muted-foreground truncate text-sm">{{ customer.contact.name || data.customerName || customer.contact.mobile }}</p>
            <p class="text-foreground text-2xl font-bold tabular-nums">{{ balance(customer.balance) }}</p>
          </div>
          @if (customer.expired) {
          <span class="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Vencido</span>
          }
        </div>

        @if (!customer.mechanic) {
        <p class="text-muted-foreground text-center text-sm">El programa de fidelización no está activo.</p>
        } @else if (!customer.rewards.length) {
        <p class="text-muted-foreground text-center text-sm">No hay recompensas activas.</p>
        } @else {
        <ul class="space-y-2" role="list">
          @for (reward of customer.rewards; track reward.id) {
          @let busy = $redeemingId() === reward.id;
          <li>
            <button
              type="button"
              class="glass-row hover:ring-primary flex w-full items-center gap-3 rounded-lg p-3 text-left hover:ring-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ring-0"
              [disabled]="!reward.affordable || $redeemingId() !== null"
              (click)="redeem(reward)">
              <span class="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <app-icon class="h-5 w-5" aria-hidden="true">{{ busy ? 'hourglass_empty' : typeIcons[reward.rewardType] }}</app-icon>
              </span>
              <span class="min-w-0 flex-1">
                <span class="text-foreground block truncate font-medium">{{ reward.name }}</span>
                <span class="text-muted-foreground block truncate text-xs">{{ valueLabel(reward) }}</span>
              </span>
              <span class="shrink-0 text-right text-xs">
                <span class="text-foreground block font-semibold">{{ balance(reward.cost) }}</span>
                @if (!reward.affordable) {
                <span class="text-muted-foreground block">{{ missing(reward.cost - customer.balance) }}</span>
                }
              </span>
            </button>
          </li>
          }
        </ul>
        }
        } @else if ($error()) {
        <div class="flex flex-col items-center gap-3 py-8 text-center">
          <app-icon class="text-muted-foreground h-10 w-10">{{ $notFound() ? 'person_off' : 'error_outline' }}</app-icon>
          <p class="text-muted-foreground text-sm">{{ $errorMessage() }}</p>
          @if (!$notFound()) {
          <app-button impact="light" size="small" type="button" (buttonClick)="customer.reload()">Reintentar</app-button>
          }
        </div>
        } @else {
        <div class="space-y-3">
          <app-skeleton size="sm" style="width: 50%" />
          <app-skeleton size="sm" style="width: 100%" />
          <app-skeleton size="sm" style="width: 100%" />
        </div>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end">
          <app-button type="button" impact="light" tone="primary" [disabled]="$redeemingId() !== null" (buttonClick)="dialogRef.close()">Cerrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LoyaltyRedeemModalComponent {
  readonly dialogRef = inject<MatDialogRef<LoyaltyRedeemModalComponent, LoyaltyRedeemResultDto>>(MatDialogRef);
  readonly data = inject<LoyaltyRedeemModalData>(MAT_DIALOG_DATA);
  readonly #service = inject(LoyaltyService);
  readonly #toast = inject(ToastService);

  readonly typeIcons = REWARD_TYPE_ICONS;
  readonly valueLabel = rewardValueLabel;

  readonly customer = rxResource({ stream: () => this.#service.getCustomer({ contactId: this.data.contactId }).pipe(toRemoteResult()) });
  readonly $customer = computed(() => resultValue(this.customer.value()));
  readonly $error = computed(() => resultError(this.customer.value()));
  readonly $notFound = computed(() => readApiError(this.$error()).status === 404);
  readonly $errorMessage = computed(() => getLoyaltyErrorMessage(this.$error(), 'No se pudo cargar el saldo.', { pos: true }) ?? 'No se pudo cargar el saldo.');
  readonly $redeemingId = signal<number | null>(null);

  /** "Faltan 3 puntos" / "Falta 1 sello". */
  missing(amount: number): string {
    return `${amount === 1 ? 'Falta' : 'Faltan'} ${this.balance(amount)}`;
  }

  balance(amount: number): string {
    return formatLoyaltyBalance(amount, this.$customer()?.mechanic ?? null);
  }

  redeem(reward: Reward) {
    if (this.$redeemingId() !== null || !reward.affordable) return;
    this.$redeemingId.set(reward.id);
    this.#service.redeem({ transactionId: this.data.transactionId, rewardId: reward.id }).subscribe({
      next: (result) => {
        this.#toast.show(`${result.rewardName} canjeada. Le queda ${this.balance(result.balance)}; total ${formatClp(result.finalTotal)}`, 'success');
        this.dialogRef.close(result);
      },
      error: (error: unknown) => {
        this.$redeemingId.set(null);
        // 404 del canje: la recompensa (o su producto) ya no existe o se desactivó.
        const message =
          readApiError(error).status === 404
            ? 'La recompensa ya no está disponible.'
            : getLoyaltyErrorMessage(error, 'No se pudo canjear la recompensa.', { mechanic: this.$customer()?.mechanic ?? null, pos: true });
        if (message) this.#toast.show(message, 'error');
        // El saldo pudo cambiar (venta anulada, otro canje).
        this.customer.reload();
      },
    });
  }
}
