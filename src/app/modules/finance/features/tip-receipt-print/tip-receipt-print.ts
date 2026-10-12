import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { escapeHtml } from 'src/app/shared/utils/printing/browser-print';
import { TipPayoutDto } from '../../data-access';
import { formatPaidAt } from '../payable-payments/payable-format';
import { tipPeriodLabel } from './tip-format';

/** Comprobante de propinas (ticket 80 mm): un bloque por persona con línea de firma. */
export function tipReceiptHtml(payout: TipPayoutDto, businessName?: string | null): string {
  const parts: string[] = [];
  parts.push('<h1>Comprobante de propinas</h1>');
  if (businessName) parts.push(`<h2>${escapeHtml(businessName)}</h2>`);
  parts.push(`<p class="center muted">Liquidación #${payout.id}${payout.locationName ? ` · ${escapeHtml(payout.locationName)}` : ''}</p>`);
  if (payout.cancelled) parts.push('<p class="center big">ANULADA</p>');
  parts.push('<div class="sep"></div>');
  parts.push(row('Período', tipPeriodLabel(payout.dateFrom, payout.dateTo)));
  parts.push(row('Fecha de pago', formatPaidAt(payout.paidAt)));
  parts.push(row('Medio', PAYMENT_METHOD_LABELS[payout.method] ?? payout.method));
  if (payout.reference) parts.push(row('Referencia', payout.reference));
  parts.push(`<div class="row total"><span>Total</span><span>${escapeHtml(formatCurrency(payout.total))}</span></div>`);

  for (const line of payout.lines) {
    parts.push('<div class="sep"></div>');
    parts.push(`<p>Recibí <b>${escapeHtml(formatCurrency(line.amount))}</b> de propinas.</p>`);
    parts.push(`<p><b>${escapeHtml(line.name ?? 'Sin nombre')}</b></p>`);
    // Espacio para firmar.
    parts.push('<div style="height:12mm"></div>');
    parts.push('<div style="border-top:1px solid #000"></div>');
    parts.push('<p class="center muted">Firma</p>');
  }
  parts.push('<div class="sep"></div>');
  return parts.join('');
}

function row(label: string, value: string): string {
  return `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}
