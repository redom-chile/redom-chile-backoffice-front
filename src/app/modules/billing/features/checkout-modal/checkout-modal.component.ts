import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  BillingService,
  CHECKOUT_ACTION_TITLES,
  CheckoutResultDto,
  formatClp,
  getBillingErrorMessage,
  INTERVAL_LABELS,
  INTERVAL_SUFFIX,
  OwnerSubscriptionDto,
  PlanInterval,
  PlanRef,
} from '../../data-access';
import { formatBillingDate, previewCheckout } from '../billing-format';

export type CheckoutModalData = Readonly<{
  plan: Pick<PlanRef, 'id' | 'name'>;
  price: Readonly<{ id: number; interval: PlanInterval; amount: number }>;
  /** Suscripción actual, para anticipar lo que va a pasar (null si no cargó). */
  subscription: OwnerSubscriptionDto | null;
  timeZone: string;
}>;

/** Confirmar la elección de un plan: resumen de lo que va a pasar, cupón y medio de pago (solo transferencia). */
@Component({
  selector: 'app-checkout-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ actionTitle }}</h2>
      </ng-template>

      <form class="space-y-4 p-2" (ngSubmit)="handleConfirm()">
        <div class="bg-primary/5 rounded-xl border border-[var(--border)] p-3">
          <p class="text-foreground font-semibold">Plan {{ data.plan.name }} · {{ intervalLabel }}</p>
          <p class="text-foreground text-2xl font-bold">
            {{ priceLabel }}<span class="text-muted-foreground text-sm font-medium">{{ suffix }}</span>
          </p>
          <p class="text-muted-foreground text-xs">IVA incluido</p>
        </div>

        <ul class="text-foreground space-y-2 text-sm">
          @for (line of summary; track $index) {
          <li class="flex items-start gap-2">
            <app-icon class="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">check_circle</app-icon>
            <span>{{ line }}</span>
          </li>
          }
        </ul>

        @if (charges) {
        <div>
          <label for="checkout-coupon" class="mb-1 block text-sm font-medium">¿Tienes un cupón?</label>
          <input
            id="checkout-coupon"
            type="text"
            maxlength="40"
            autocomplete="off"
            placeholder="Ej: LANZAMIENTO"
            [formControl]="coupon"
            class="glass-input w-full rounded-md px-3 py-2 uppercase" />
          <p class="text-muted-foreground mt-1 text-xs">Lo validamos al confirmar y se descuenta de este cobro.</p>
        </div>

        <fieldset>
          <legend class="mb-1 block text-sm font-medium">Medio de pago</legend>
          <div class="space-y-2">
            <label class="border-primary bg-primary/5 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5">
              <input type="radio" name="checkout-method" checked class="accent-[var(--primary)]" />
              <app-icon class="text-primary h-5 w-5" aria-hidden="true">account_balance</app-icon>
              <span class="text-foreground text-sm font-medium">Transferencia bancaria</span>
            </label>
            <div class="text-muted-foreground flex items-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 opacity-70">
              <input type="radio" name="checkout-method" disabled />
              <app-icon class="h-5 w-5" aria-hidden="true">credit_card</app-icon>
              <span class="text-sm">Pago con tarjeta: próximamente</span>
            </div>
          </div>
        </fieldset>
        }
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleConfirm()">
            {{ confirmText }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class CheckoutModalComponent {
  readonly dialogRef = inject<MatDialogRef<CheckoutModalComponent, CheckoutResultDto>>(MatDialogRef);
  readonly data = inject<CheckoutModalData>(MAT_DIALOG_DATA);
  readonly #billing = inject(BillingService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly action = previewCheckout(this.data.subscription, this.data.price);
  readonly actionTitle = CHECKOUT_ACTION_TITLES[this.action];
  /** scheduled no genera cobro ahora: sin cupón ni medio de pago. */
  readonly charges = this.action !== 'scheduled';
  readonly intervalLabel = INTERVAL_LABELS[this.data.price.interval].toLowerCase();
  readonly priceLabel = formatClp(this.data.price.amount);
  readonly suffix = INTERVAL_SUFFIX[this.data.price.interval];
  readonly confirmText = this.charges ? 'Confirmar y pagar por transferencia' : 'Programar cambio';
  readonly summary = this.#summary();

  readonly coupon = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] });
  readonly $isSaving = signal(false);

  handleConfirm() {
    if (this.$isSaving()) return;
    const couponCode = this.charges ? this.coupon.value.trim().toUpperCase() : '';
    this.$isSaving.set(true);
    this.#billing
      .checkout({ priceId: this.data.price.id, method: 'manual', ...(couponCode ? { couponCode } : {}) })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => this.dialogRef.close(result),
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getBillingErrorMessage(error, 'No se pudo cambiar el plan'), 'error');
        },
      });
  }

  #summary(): string[] {
    const { plan, subscription, timeZone } = this.data;
    const periodEnd = formatBillingDate(subscription?.currentPeriodEnd, timeZone);
    switch (this.action) {
      case 'purchase':
        return [
          `Te generamos un cobro de ${this.priceLabel} que pagas por transferencia dentro de 7 días.`,
          subscription?.status === 'trialing'
            ? `El plan ${plan.name} empieza cuando confirmemos tu pago, y en ese momento termina tu prueba.`
            : `El plan ${plan.name} empieza cuando confirmemos tu pago.`,
          'Si tenías un cobro sin pagar de otro plan, este lo reemplaza.',
        ];
      case 'renewal':
        return [
          `Pagas por adelantado tu próximo período, que empieza el ${periodEnd}.`,
          ...(subscription?.scheduledPlan ? [`Se deshace el cambio programado a ${subscription.scheduledPlan.name}.`] : []),
        ];
      case 'upgrade':
        return [
          `Cambias a ${plan.name} al tiro.`,
          `Se cobra la diferencia prorrateada por lo que queda de tu período (hasta el ${periodEnd}), a pagar en 3 días.`,
          `Desde el ${periodEnd} pagas ${this.priceLabel}${this.suffix}.`,
        ];
      case 'scheduled':
        return [
          `Tu plan cambia a ${plan.name} ${this.intervalLabel} el ${periodEnd}, al terminar tu período actual.`,
          'Hasta entonces sigues con tu plan de ahora. No se cobra nada hoy.',
        ];
    }
  }
}

export function openCheckoutModal(dialog: MatDialog, data: CheckoutModalData): Observable<CheckoutResultDto | undefined> {
  return dialog
    .open<CheckoutModalComponent, CheckoutModalData, CheckoutResultDto>(CheckoutModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
