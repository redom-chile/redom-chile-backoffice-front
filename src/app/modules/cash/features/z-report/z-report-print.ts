import { formatDateTimeFull } from 'src/app/modules/inventory/shared';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { escapeHtml } from 'src/app/shared/utils/printing/browser-print';
import { CASH_MOVEMENT_LABELS, CashSessionDto, cashMovementSign, PAYMENT_METHOD_LABELS } from '../../data-access';
import { formatTime } from '../../ui';

function row(label: string, value: string, className = ''): string {
  return `<div class="row ${className}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function signed(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return 'Cuadrada';
  return `${value < 0 ? '-' : '+'}${formatCurrency(Math.abs(value))} ${value < 0 ? 'faltante' : 'sobrante'}`;
}

/** Reporte Z en HTML para imprimir en rollo (80 mm) con printHtml. */
export function zReportHtml(session: CashSessionDto): string {
  const parts: string[] = [];
  parts.push(`<h1>Reporte Z${session.status === 'closed' ? '' : ' (parcial)'}</h1>`);
  parts.push(`<h2>${escapeHtml(session.registerName)}</h2>`);
  parts.push(`<p class="center muted">${escapeHtml(session.locationName)} · Turno #${session.id}</p>`);
  if (session.status === 'open') parts.push('<p class="center muted">Turno abierto: montos parciales</p>');
  parts.push('<div class="sep"></div>');
  parts.push(row('Apertura', formatDateTimeFull(session.openedAt)));
  parts.push(row('Abrió', session.openedByName ?? session.openedBy ?? '—'));
  if (session.closedAt) {
    parts.push(row('Cierre', formatDateTimeFull(session.closedAt)));
    parts.push(row('Cerró', session.closedByName ?? session.closedBy ?? '—'));
  }
  parts.push(row('Fondo inicial', formatCurrency(session.openingAmount)));

  const totals = session.totals;
  if (session.detailVisible && totals) {
    parts.push('<div class="sep"></div>');
    parts.push(row(`Ventas (${totals.salesCount})`, formatCurrency(totals.sales)));
    parts.push(row('Propinas', formatCurrency(totals.tips)));
    parts.push(row(`Devoluciones (${totals.refundsCount})`, formatCurrency(totals.refunds)));
    parts.push(row('Ingresos', formatCurrency(totals.cashIn)));
    parts.push(row('Retiros', formatCurrency(totals.cashOut)));
    if (totals.expenses > 0) parts.push(row('Gastos pagados', `-${formatCurrency(totals.expenses)}`));
    if ((totals.expenseRefunds ?? 0) > 0) parts.push(row('Anulaciones de gastos', `+${formatCurrency(totals.expenseRefunds ?? 0)}`));
    if ((totals.tipPayouts ?? 0) > 0) parts.push(row('Propinas pagadas', `-${formatCurrency(totals.tipPayouts ?? 0)}`));
    if ((totals.tipPayoutRefunds ?? 0) > 0) parts.push(row('Anulaciones de propinas', `+${formatCurrency(totals.tipPayoutRefunds ?? 0)}`));

    for (const method of session.methods ?? []) {
      parts.push('<div class="sep"></div>');
      parts.push(`<p><b>${escapeHtml(PAYMENT_METHOD_LABELS[method.method] ?? method.method)}</b></p>`);
      parts.push(row(`Ventas (${method.salesCount})`, formatCurrency(method.sales)));
      if (method.tips) parts.push(row('Propinas', formatCurrency(method.tips)));
      if (method.refunds) parts.push(row(`Devoluciones (${method.refundsCount})`, formatCurrency(method.refunds)));
      parts.push(row('Esperado', formatCurrency(method.expected)));
      parts.push(row('Contado', formatCurrency(method.counted)));
      parts.push(row('Diferencia', signed(method.difference)));
      for (const denomination of method.denominations ?? []) {
        if (!denomination.quantity) continue;
        parts.push(
          row(`  ${formatCurrency(denomination.value)} x ${denomination.quantity}`, formatCurrency(denomination.value * denomination.quantity), 'sub'),
        );
      }
    }

    parts.push('<div class="sep"></div>');
    parts.push(row('Efectivo esperado', formatCurrency(session.cashExpected), 'total'));
    parts.push(row('Efectivo contado', formatCurrency(session.cashCounted), 'total'));
    parts.push(row('Diferencia', signed(session.cashDifference), 'total'));

    const movements = session.movements ?? [];
    if (movements.length) {
      parts.push('<div class="sep"></div>');
      parts.push('<p><b>Movimientos</b></p>');
      for (const movement of movements) {
        const sign = cashMovementSign(movement.type) < 0 ? '-' : '+';
        const label = `${formatTime(movement.createdAt)} ${CASH_MOVEMENT_LABELS[movement.type] ?? movement.type} ${PAYMENT_METHOD_LABELS[movement.method] ?? ''}`;
        parts.push(row(label, `${sign}${formatCurrency(movement.amount)}`, 'muted'));
        const detail = [movement.invoiceNo ? `Boleta ${movement.invoiceNo}` : '', movement.reason ?? ''].filter(Boolean).join(' · ');
        if (detail) parts.push(`<div class="sub muted">${escapeHtml(detail)}</div>`);
      }
    }
  } else {
    parts.push('<div class="sep"></div>');
    parts.push('<p class="center">El detalle se ve al cerrar.</p>');
  }

  if (session.notes) {
    parts.push('<div class="sep"></div>');
    parts.push(`<p class="muted">Notas: ${escapeHtml(session.notes)}</p>`);
  }
  parts.push('<div class="sep"></div>');
  parts.push(`<p class="center muted">Impreso ${escapeHtml(formatDateTimeFull(new Date().toISOString()))}</p>`);
  return parts.join('');
}
