import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { LegalApiService, legalDocumentsOf, legalErrorMessage, PendingDocumentDto, requiredAccepted } from 'src/app/core/services/legal';
import { LegalDocumentChecklistComponent } from 'src/app/modules/legal/ui';
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
import { cardLabel, formatBillingDate, goToFlow, previewCheckout } from '../billing-format';

type CheckoutMethod = 'flow' | 'manual';

const BUSINESS_DOCUMENTS: readonly string[] = ['subscriptionTerms', 'dataProcessingAgreement'];

const METHODS: ReadonlyArray<Readonly<{ value: CheckoutMethod; label: string; icon: string }>> = [
  { value: 'flow', label: 'Tarjeta (Flow)', icon: 'credit_card' },
  { value: 'manual', label: 'Transferencia bancaria', icon: 'account_balance' },
];

export type CheckoutModalData = Readonly<{
  plan: Pick<PlanRef, 'id' | 'name'>;
  price: Readonly<{ id: number; interval: PlanInterval; amount: number }>;
  /** Suscripción actual, para anticipar lo que va a pasar (null si no cargó). */
  subscription: OwnerSubscriptionDto | null;
  timeZone: string;
}>;

/**
 * Confirmar la elección de un plan: resumen, cupón y medio de pago. Con tarjeta, si no hay una registrada se va al
 * formulario de Flow; si la hay, se cobra al tiro y el resultado se muestra en "Mi suscripción" (/billing?payment=…).
 */
@Component({
  selector: 'app-checkout-modal',
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, LegalDocumentChecklistComponent],
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
          @for (line of $summary(); track $index) {
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
        }

        <fieldset>
          <legend class="mb-1 block text-sm font-medium">{{ charges ? 'Medio de pago' : 'Cómo pagarás desde el próximo período' }}</legend>
          <div class="space-y-2">
            @for (option of methods; track option.value) {
            <label
              class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition"
              [class]="$method() === option.value ? 'border-primary bg-primary/5' : 'border-[var(--border)] hover:bg-foreground/5'">
              <input
                type="radio"
                name="checkout-method"
                class="mt-1 accent-[var(--primary)]"
                [value]="option.value"
                [checked]="$method() === option.value"
                [disabled]="$isSaving()"
                (change)="$method.set(option.value)" />
              <app-icon class="mt-0.5 h-5 w-5 shrink-0" [class.text-primary]="$method() === option.value" aria-hidden="true">{{ option.icon }}</app-icon>
              <span class="min-w-0">
                <span class="text-foreground block text-sm font-medium">{{ option.label }}</span>
                @if (option.value === 'flow') {
                <span class="text-muted-foreground block text-xs">
                  @if (card) {
                  Se cobra a tu {{ card }}.
                  }
                  Ingresas tu tarjeta en el formulario seguro de Flow. Redom solo guarda la marca y los últimos 4 dígitos.
                </span>
                }
              </span>
            </label>
            }
          </div>
        </fieldset>
        @if ($legalDocuments().length) {
        <app-legal-document-checklist legend="Condiciones del plan" [documents]="$legalDocuments()" [(accepted)]="$legalAccepted"
          [disabled]="$isSaving()" [showErrors]="$legalSubmitted()" />
        }
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleConfirm()">
            {{ $confirmText() }}
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
  readonly #entitlements = inject(EntitlementsService);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #legal = inject(LegalApiService);

  // Condiciones del servicio y tratamiento de datos que el negocio aún no acepta (si los hay, van con la compra).
  readonly $legalDocuments = signal<readonly PendingDocumentDto[]>([]);
  readonly $legalAccepted = signal<readonly number[]>([]);
  readonly $legalSubmitted = signal(false);

  constructor() {
    this.#loadLegal();
  }

  #loadLegal() {
    this.#legal
      .me()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (me) => this.#showLegal(me.pending.filter((document) => BUSINESS_DOCUMENTS.includes(document.documentCode))),
        // Sin la lista, el backend responde 400 con los que falten y se muestran ahí.
        error: () => undefined,
      });
  }

  readonly action = previewCheckout(this.data.subscription, this.data.price);
  readonly actionTitle = CHECKOUT_ACTION_TITLES[this.action];
  /** scheduled no genera cobro ahora: sin cupón; el medio de pago es para el próximo período. */
  readonly charges = this.action !== 'scheduled';
  readonly intervalLabel = INTERVAL_LABELS[this.data.price.interval].toLowerCase();
  readonly priceLabel = formatClp(this.data.price.amount);
  readonly suffix = INTERVAL_SUFFIX[this.data.price.interval];
  readonly methods = METHODS;
  /** "Visa •••• 6623" si ya tiene tarjeta registrada. */
  readonly card = cardLabel(this.data.subscription?.card ?? null);

  readonly $method = signal<CheckoutMethod>(this.card ? 'flow' : 'manual');
  readonly $confirmText = computed(() => {
    const flow = this.$method() === 'flow';
    if (!this.charges) return flow && !this.card ? 'Programar y registrar tarjeta' : 'Programar cambio';
    if (!flow) return 'Confirmar y pagar por transferencia';
    return this.card ? 'Confirmar y pagar con tarjeta' : 'Continuar a Flow';
  });
  readonly $summary = computed(() => this.#summary(this.$method()));

  readonly coupon = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] });
  readonly $isSaving = signal(false);

  handleConfirm() {
    if (this.$isSaving()) return;
    this.$legalSubmitted.set(true);
    if (!requiredAccepted(this.$legalDocuments(), this.$legalAccepted())) return;
    const method = this.$method();
    const couponCode = this.charges ? this.coupon.value.trim().toUpperCase() : '';
    const acceptedVersionIds = this.$legalAccepted().length ? [...this.$legalAccepted()] : undefined;
    this.$isSaving.set(true);
    this.#billing
      .checkout({ priceId: this.data.price.id, method, ...(couponCode ? { couponCode } : {}), ...(acceptedVersionIds ? { acceptedVersionIds } : {}) })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => this.#handleResult(result),
        error: (error: unknown) => {
          this.$isSaving.set(false);
          const legal = legalErrorMessage(error);
          if (legal) {
            this.#toast.show(legal, 'warning');
            const documents = legalDocumentsOf(error);
            if (documents) this.#showLegal(documents);
            else this.#loadLegal();
            return;
          }
          this.#toast.show(getBillingErrorMessage(error, 'No se pudo cambiar el plan'), 'error');
        },
      });
  }

  #showLegal(documents: readonly PendingDocumentDto[]) {
    this.$legalDocuments.set(documents);
    this.$legalAccepted.set([]);
    this.$legalSubmitted.set(false);
  }

  /** Con tarjeta el modal resuelve todo; quien lo abrió solo maneja transferencia y cambios programados. */
  #handleResult(result: CheckoutResultDto) {
    if (result.redirectUrl) {
      this.#toast.show('Te llevamos a Flow para registrar tu tarjeta', 'success');
      this.dialogRef.close(result);
      goToFlow(result.redirectUrl);
      return;
    }
    this.dialogRef.close(result);
    const charge = result.charge;
    if (!charge) return;
    this.#entitlements.refresh();
    this.#router.navigate(['/billing'], {
      queryParams: { payment: charge.status, ...(result.invoice ? { invoice: result.invoice.id } : {}) },
      state: { chargeMessage: charge.message },
    });
  }

  #summary(method: CheckoutMethod): string[] {
    const { plan, subscription, timeZone } = this.data;
    const flow = method === 'flow';
    const target = this.card ? `tu ${this.card}` : 'la tarjeta que registres en Flow';
    const periodEnd = formatBillingDate(subscription?.currentPeriodEnd, timeZone);
    switch (this.action) {
      case 'purchase':
        return [
          flow
            ? `Cobramos ${this.priceLabel} a ${target}.`
            : `Te generamos un cobro de ${this.priceLabel} que pagas por transferencia dentro de 7 días.`,
          subscription?.status === 'trialing'
            ? `El plan ${plan.name} empieza cuando se confirme tu pago, y en ese momento termina tu prueba.`
            : `El plan ${plan.name} empieza cuando se confirme tu pago.`,
          'Si tenías un cobro sin pagar de otro plan, este lo reemplaza.',
        ];
      case 'renewal':
        return [
          flow
            ? `Cobramos a ${target} tu próximo período, que empieza el ${periodEnd}.`
            : `Pagas por adelantado tu próximo período, que empieza el ${periodEnd}.`,
          ...(subscription?.scheduledPlan ? [`Se deshace el cambio programado a ${subscription.scheduledPlan.name}.`] : []),
        ];
      case 'upgrade':
        return [
          `Cambias a ${plan.name} al tiro.`,
          flow
            ? `Cobramos a ${target} la diferencia prorrateada por lo que queda de tu período (hasta el ${periodEnd}).`
            : `Se cobra la diferencia prorrateada por lo que queda de tu período (hasta el ${periodEnd}), a pagar en 3 días.`,
          `Desde el ${periodEnd} pagas ${this.priceLabel}${this.suffix}.`,
        ];
      case 'scheduled':
        return [
          `Tu plan cambia a ${plan.name} ${this.intervalLabel} el ${periodEnd}, al terminar tu período actual.`,
          'Hasta entonces sigues con tu plan de ahora. No se cobra nada hoy.',
          ...(flow && !this.card ? ['Registra tu tarjeta en Flow para que el próximo período se cobre ahí.'] : []),
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
