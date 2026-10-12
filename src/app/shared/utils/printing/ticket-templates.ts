import { escapeHtml } from './browser-print';

export type KitchenTicketData = Readonly<{
  stationName: string | null;
  invoiceNo: string | null;
  tableName: string | null;
  waiterName: string | null;
  staffNote: string | null;
  createdAt: string | Date;
  items: ReadonlyArray<{
    productName: string | null;
    variationName: string | null;
    quantity: number | null;
    notes: string | null;
    // Modificadores ya formateados ("Extra queso", "2 x Sin hielo").
    modifiers?: ReadonlyArray<string> | null;
  }>;
}>;

export type BillTicketData = Readonly<{
  businessName: string;
  invoiceNo: string;
  tableName: string | null;
  waiterName: string | null;
  // total: producto + sus modificadores. modifiers: ya formateados, se imprimen bajo el producto.
  lines: ReadonlyArray<{ name: string; quantity: number; total: number; modifiers?: ReadonlyArray<string> | null }>;
  subtotal: number;
  discount: number;
  total: number;
  taxAmount: number;
  paid: number;
  remaining: number;
  // Propina sugerida en porcentaje (0 para no mostrarla).
  suggestedTipPercent: number;
  // Título y nota opcionales (p. ej. precuenta por persona al dividir la cuenta).
  title?: string;
  note?: string;
}>;

const time = (date: string | Date) =>
  new Date(date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
const dateTime = (date: Date) =>
  date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const money = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
// Modificadores bajo el producto: en comanda destacados (mod), en precuenta discretos (sub).
const modifierLines = (modifiers: ReadonlyArray<string> | null | undefined, cssClass: 'mod' | 'sub' = 'mod') =>
  (modifiers ?? []).map((modifier) => `<div class="${cssClass}">+ ${escapeHtml(modifier)}</div>`).join('');
const variation = (name: string | null) => (name && name !== 'DUMMY' ? ` (${escapeHtml(name)})` : '');

// Comanda para cocina/bar: grande y sin precios.
export function kitchenTicketHtml(ticket: KitchenTicketData): string {
  const items = ticket.items
    .map(
      (item) => `<div class="item"><span class="qty">${item.quantity ?? 1}x</span><span>${escapeHtml(item.productName)}${variation(item.variationName)}</span></div>
      ${modifierLines(item.modifiers)}
      ${item.notes ? `<div class="note">» ${escapeHtml(item.notes)}</div>` : ''}`,
    )
    .join('');
  return `
    ${ticket.stationName ? `<h2>${escapeHtml(ticket.stationName).toUpperCase()}</h2>` : ''}
    <h1>${escapeHtml(ticket.tableName ?? 'SIN MESA')}</h1>
    <div class="row muted"><span>${escapeHtml(ticket.invoiceNo)}</span><span>${time(ticket.createdAt)}</span></div>
    ${ticket.waiterName ? `<div class="muted">Mesero: ${escapeHtml(ticket.waiterName)}</div>` : ''}
    <div class="sep"></div>
    ${items}
    ${ticket.staffNote ? `<div class="sep"></div><div><b>Nota:</b> ${escapeHtml(ticket.staffNote)}</div>` : ''}
    <div class="sep"></div>`;
}

// Precuenta para el cliente (no es boleta).
// Logotipo monocromo (src/assets/brand/redom-logo-mono.svg): en papel térmico solo se usa una tinta.
const REDOM_LOGO_MONO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -172 604.73 196" role="img" aria-label="REDOM"><g fill="none" stroke="#1C1815" stroke-width="18" stroke-linecap="butt"><path d="M9 0V-100"/><path d="M9 -50A41 41 0 0 1 71.73 -84.77"/><path d="M181.7 -51.43A41 41 0 1 0 173.04 -24.76"/><path d="M99.73 -50H181.73"/><path d="M293.73 -50A41 41 0 1 0 293.73 -49.93"/><path d="M293.73 0V-148"/><path d="M374.43 -90.6A41 41 0 1 0 406.74 -65.36"/><path d="M439.73 0V-100"/><path d="M439.73 0V-64A27 27 0 0 1 493.73 -64V0"/><path d="M493.73 -64A27 27 0 0 1 547.73 -64V0"/></g><circle cx="393.97" cy="-82.31" r="10" fill="#1C1815"/></svg>`;

const brand = (heightMm: number) => `<div class="center" style="margin:1mm 0"><span style="display:inline-block;height:${heightMm}mm">${REDOM_LOGO_MONO.replace('<svg ', '<svg style="height:100%;width:auto" ')}</span></div>`;

export function billTicketHtml(bill: BillTicketData): string {
  const lines = bill.lines
    .map(
      (line) =>
        `<div class="row"><span>${line.quantity}x ${escapeHtml(line.name)}</span><span>${money(line.total)}</span></div>${modifierLines(line.modifiers, 'sub')}`,
    )
    .join('');
  const tip = Math.round((bill.total * bill.suggestedTipPercent) / 100);
  return `
    <h2>${escapeHtml(bill.businessName)}</h2>
    <div class="center big">${escapeHtml(bill.title ?? 'PRECUENTA')}</div>
    <div class="center muted">${dateTime(new Date())}</div>
    <div class="row muted"><span>${escapeHtml(bill.invoiceNo)}</span><span>${escapeHtml(bill.tableName ?? 'Sin mesa')}</span></div>
    ${bill.waiterName ? `<div class="muted">Atendido por: ${escapeHtml(bill.waiterName)}</div>` : ''}
    <div class="sep"></div>
    ${lines}
    <div class="sep"></div>
    <div class="row"><span>Subtotal</span><span>${money(bill.subtotal)}</span></div>
    ${bill.discount > 0 ? `<div class="row"><span>Descuento</span><span>-${money(bill.discount)}</span></div>` : ''}
    <div class="row total"><span>TOTAL</span><span>${money(bill.total)}</span></div>
    <div class="row muted"><span>IVA incluido</span><span>${money(bill.taxAmount)}</span></div>
    ${bill.paid > 0 ? `<div class="row"><span>Pagado</span><span>${money(bill.paid)}</span></div><div class="row total"><span>SALDO</span><span>${money(bill.remaining)}</span></div>` : ''}
    ${bill.suggestedTipPercent > 0 ? `<div class="sep"></div><div class="row"><span>Propina sugerida ${bill.suggestedTipPercent}%</span><span>${money(tip)}</span></div><div class="row"><span>Total con propina</span><span>${money(bill.remaining + tip)}</span></div>` : ''}
    <div class="sep"></div>
    ${bill.note ? `<div class="center muted">${escapeHtml(bill.note)}</div>` : ''}
    <div class="center muted">Documento no válido como boleta</div>
    <div class="center">¡Gracias por su visita!</div>
    ${brand(3.5)}`;
}

export function testTicketHtml(printerName: string): string {
  return `
    ${brand(7)}
    <div class="center big">PRUEBA DE IMPRESIÓN</div>
    <div class="sep"></div>
    <div>Impresora: ${escapeHtml(printerName)}</div>
    <div>Fecha: ${dateTime(new Date())}</div>
    <div class="sep"></div>
    <div class="item"><span class="qty">2x</span><span>Producto de prueba</span></div>
    <div class="note">» nota de ejemplo</div>
    <div class="sep"></div>
    <div class="center">Si puedes leer esto, la impresora funciona.</div>`;
}
