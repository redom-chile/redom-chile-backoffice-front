import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { BillingPaymentDto, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from 'src/app/modules/billing/data-access';
import { ButtonComponent, IconComponent } from 'src/ui';
import { formatClp, formatPlatformDate, PlatformInvoiceDto } from '../../data-access';
import { PaymentActionsService } from '../payment-actions';
import { invoiceLabel, isReversible, PaymentTarget, signedAmount } from '../payment-shared';

/** Pagos de un cobro con sus acciones (registrar, confirmar, rechazar y reversar). Emite `changed` tras cada acción. */
@Component({
  selector: 'app-invoice-payments',
  imports: [ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let inv = invoice();
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-foreground text-sm font-semibold">
        Pagos <span class="text-muted-foreground font-normal">({{ inv.payments.length }})</span>
      </p>
      @if ($isPayable()) {
        <app-button type="button" size="small" impact="light" icon="add" [disabled]="$busy()" (buttonClick)="register()">Registrar pago</app-button>
      }
    </div>

    @if (!inv.payments.length) {
      <p class="text-muted-foreground mt-2 text-sm">Todavía no hay pagos para este cobro.</p>
    } @else {
      <ul class="mt-2 divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
        @for (payment of inv.payments; track payment.id) {
          <li class="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-start">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-foreground font-medium">{{ kindLabels[payment.kind] }}</span>
                <span class="text-muted-foreground">· {{ methodLabels[payment.method] }}</span>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="statusTones[payment.status]">{{ statusLabels[payment.status] }}</span>
              </div>
              <p class="text-muted-foreground mt-0.5 text-xs">
                Pagado {{ formatDate(payment.paidAt, true) }} · Registrado {{ formatDate(payment.createdAt, true) }}
                @if (payment.reference) {
                  · Ref. <span class="font-mono">{{ payment.reference }}</span>
                }
                @if (payment.reversesPaymentId) {
                  · Reversa el pago #{{ payment.reversesPaymentId }}
                }
              </p>
              @if (payment.comment) {
                <p class="text-foreground mt-1 text-xs break-words">"{{ payment.comment }}"</p>
              }
              @if (payment.rejectionReason) {
                <p class="mt-1 text-xs break-words text-red-700 dark:text-red-400">Motivo del rechazo: {{ payment.rejectionReason }}</p>
              }
              @if (payment.receiptUrl) {
                <a [href]="payment.receiptUrl" target="_blank" rel="noopener noreferrer" class="text-primary mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline">
                  <app-icon class="h-4 w-4">receipt_long</app-icon> Ver comprobante
                </a>
              }
            </div>
            <div class="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <span class="whitespace-nowrap font-semibold tabular-nums" [class]="signed(payment) < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'">
                {{ signed(payment) < 0 ? '−' : '' }}{{ formatClp(payment.amount) }}
              </span>
              <div class="flex flex-wrap gap-2">
                @if (payment.status === 'pending') {
                  <app-button type="button" size="small" impact="light" tone="danger" [disabled]="$busy()" (buttonClick)="reject(payment)">Rechazar</app-button>
                  <app-button type="button" size="small" impact="bold" tone="success" [disabled]="$busy()" (buttonClick)="confirm(payment)">Confirmar</app-button>
                } @else if (reversible(payment)) {
                  <app-button type="button" size="small" impact="light" tone="danger" [disabled]="$busy()" (buttonClick)="reverse(payment)">Reversar</app-button>
                }
              </div>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class InvoicePaymentsComponent {
  readonly #actions = inject(PaymentActionsService);
  readonly #destroyRef = inject(DestroyRef);

  readonly invoice = input.required<PlatformInvoiceDto>();
  readonly changed = output<void>();

  readonly formatClp = formatClp;
  readonly formatDate = formatPlatformDate;
  readonly signed = signedAmount;
  readonly kindLabels = PAYMENT_KIND_LABELS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly statusLabels = PAYMENT_STATUS_LABELS;
  readonly statusTones = PAYMENT_STATUS_TONES;

  readonly $busy = signal(false);
  readonly $isPayable = computed(() => this.invoice().status === 'pending' || this.invoice().status === 'overdue');

  reversible(payment: BillingPaymentDto): boolean {
    return isReversible(payment, this.invoice().payments);
  }

  register() {
    const inv = this.invoice();
    this.#run(
      this.#actions.register({
        id: inv.id,
        businessName: inv.business.name,
        label: invoiceLabel(inv),
        total: inv.total,
        paidAmount: inv.paidAmount,
        pendingAmount: inv.pendingAmount,
      }),
    );
  }

  confirm(payment: BillingPaymentDto) {
    this.#run(this.#actions.confirm(this.#target(payment)));
  }

  reject(payment: BillingPaymentDto) {
    this.#run(this.#actions.reject(this.#target(payment)));
  }

  reverse(payment: BillingPaymentDto) {
    this.#run(this.#actions.reverse(this.#target(payment)));
  }

  #target(payment: BillingPaymentDto): PaymentTarget {
    return { id: payment.id, amount: payment.amount, method: payment.method, reference: payment.reference, businessName: this.invoice().business.name };
  }

  #run(action$: Observable<boolean>) {
    this.$busy.set(true);
    action$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (changed) => {
        this.$busy.set(false);
        if (changed) this.changed.emit();
      },
      error: () => this.$busy.set(false),
    });
  }
}
