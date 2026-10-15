import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { LoyaltyRedeemResultDto } from 'src/app/modules/loyalty/data-access';
import { IconComponent } from 'src/ui';
import { openLoyaltyRedeemModal } from './loyalty-redeem-modal.component';

/** Botón "Fidelización" de una venta abierta: solo con cliente, plan con fidelización y permiso de canjear. */
@Component({
  selector: 'app-loyalty-redeem-button',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($visible()) {
    <button
      type="button"
      [class]="
        variant() === 'pos'
          ? 'border-primary text-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold disabled:opacity-40'
          : 'glass-row text-primary inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium disabled:opacity-40'
      "
      [disabled]="disabled()"
      (click)="open()">
      <app-icon class="h-5 w-5" aria-hidden="true">loyalty</app-icon>Fidelización
    </button>
    }
  `,
})
export class LoyaltyRedeemButtonComponent {
  readonly #dialog = inject(MatDialog);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);

  readonly transactionId = input.required<number>();
  readonly contactId = input<number | null>(null);
  readonly customerName = input<string | null>(null);
  readonly disabled = input(false);
  readonly variant = input<'pos' | 'page'>('page');
  /** Tras canjear: hay que recargar la venta. */
  readonly redeemed = output<LoyaltyRedeemResultDto>();

  readonly $visible = computed(
    () => !!this.contactId() && this.#entitlements.hasFeature('loyalty') && this.#access.can(PERMISSIONS.LOYALTY.REDEEM),
  );

  open() {
    const contactId = this.contactId();
    if (!contactId) return;
    openLoyaltyRedeemModal(this.#dialog, { transactionId: this.transactionId(), contactId, customerName: this.customerName() })
      .pipe(filter((result) => !!result))
      .subscribe((result) => this.redeemed.emit(result!));
  }
}
