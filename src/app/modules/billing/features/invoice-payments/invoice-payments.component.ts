import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from 'src/ui';
import {
  BillingPaymentDto,
  formatClp,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
} from '../../data-access';
import { BillingDatePipe } from '../billing-format';

/** Pagos de un cobro: método, monto, estado, fecha, referencia, comprobante y motivo del rechazo. */
@Component({
  selector: 'app-invoice-payments',
  imports: [IconComponent, BillingDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2">
      @for (payment of payments(); track payment.id) {
      <li class="glass-row rounded-lg px-3 py-2 text-sm">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="text-foreground font-medium">
            {{ payment.kind === 'payment' ? methodLabels[payment.method] : kindLabels[payment.kind] }}
          </span>
          <span class="text-foreground font-semibold tabular-nums">{{ payment.kind === 'payment' ? '' : '−' }}{{ clp(payment.amount) }}</span>
          <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" [class]="statusTones[payment.status]">
            {{ statusLabels[payment.status] }}
          </span>
          <span class="text-muted-foreground text-xs">{{ payment.paidAt ?? payment.createdAt | billingDate: timeZone() : 'datetime' }}</span>
          @if (payment.reference) {
          <span class="text-muted-foreground text-xs">Ref. {{ payment.reference }}</span>
          }
          @if (payment.receiptUrl) {
          <a
            [href]="payment.receiptUrl"
            target="_blank"
            rel="noopener"
            class="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
            <app-icon class="h-4 w-4" aria-hidden="true">receipt_long</app-icon>
            Ver comprobante
          </a>
          }
        </div>
        @if (payment.status === 'rejected') {
        <p class="text-destructive mt-1 text-xs font-medium">Rechazada: {{ payment.rejectionReason || 'sin motivo informado' }}</p>
        }
        @if (payment.comment) {
        <p class="text-muted-foreground mt-1 text-xs">{{ payment.comment }}</p>
        }
      </li>
      }
    </ul>
  `,
})
export class InvoicePaymentsComponent {
  readonly payments = input.required<readonly BillingPaymentDto[]>();
  readonly timeZone = input.required<string>();

  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly kindLabels = PAYMENT_KIND_LABELS;
  readonly statusLabels = PAYMENT_STATUS_LABELS;
  readonly statusTones = PAYMENT_STATUS_TONES;
  readonly clp = formatClp;
}
