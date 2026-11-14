export type PaperWidth = 58 | 80;

// Tamaño del texto de los tickets (precuenta, comprobante, comanda). Se elige por equipo en la Estación de impresión.
export type TicketTextSize = 'normal' | 'large' | 'xlarge';
export const DEFAULT_TICKET_TEXT_SIZE: TicketTextSize = 'large';

// Tamaño base en px según rollo; títulos, totales e ítems escalan en proporción (em).
const BASE_FONT_PX: Record<TicketTextSize, Record<PaperWidth, number>> = {
  normal: { 58: 11, 80: 12 },
  large: { 58: 14, 80: 15 },
  xlarge: { 58: 16, 80: 18 },
};

/**
 * Imprime un HTML en la impresora predeterminada del equipo usando un iframe oculto.
 * Con Chrome en modo kiosco (--kiosk-printing) no muestra el diálogo de impresión.
 * Se resuelve cuando el navegador terminó de enviar el documento (evento afterprint).
 */
export function printHtml(
  bodyHtml: string,
  paperWidth: PaperWidth = 80,
  textSize: TicketTextSize = DEFAULT_TICKET_TEXT_SIZE,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);

    const cleanup = () => setTimeout(() => iframe.remove(), 500);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      reject(new Error('No se pudo preparar la impresión'));
      return;
    }

    doc.open();
    doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ticketStyles(paperWidth, textSize)}</style></head><body>${bodyHtml}</body></html>`);
    doc.close();

    const run = () => {
      try {
        win.addEventListener('afterprint', () => {
          cleanup();
          resolve();
        }, { once: true });
        win.focus();
        win.print();
        // Algunos navegadores no emiten afterprint: se da por terminado tras un margen.
        setTimeout(() => {
          cleanup();
          resolve();
        }, 3000);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('Error al imprimir'));
      }
    };
    // Espera a que carguen las fuentes/estilos del iframe.
    if (doc.readyState === 'complete') setTimeout(run, 50);
    else win.addEventListener('load', () => setTimeout(run, 50), { once: true });
  });
}

function ticketStyles(paperWidth: PaperWidth, textSize: TicketTextSize): string {
  // El área imprimible real es algo menor que el ancho del rollo.
  const printable = paperWidth === 58 ? 48 : 72;
  return `
    @page { size: ${paperWidth}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: ${printable}mm; margin: 0 auto; padding: 2mm 0 6mm; font-family: 'Courier New', monospace; font-size: ${(BASE_FONT_PX[textSize] ?? BASE_FONT_PX[DEFAULT_TICKET_TEXT_SIZE])[paperWidth]}px; line-height: 1.3; color: #000; }
    h1 { font-size: 1.6em; margin: 0 0 1mm; text-align: center; }
    h2 { font-size: 1.15em; margin: 0; text-align: center; }
    .center { text-align: center; }
    .muted { font-size: 0.9em; }
    .sep { border-top: 1px dashed #000; margin: 2mm 0; }
    .row { display: flex; justify-content: space-between; gap: 2mm; }
    .item { display: flex; gap: 2mm; margin: 1mm 0; font-size: 1.15em; }
    .qty { font-weight: bold; min-width: 8mm; }
    .mod { margin-left: 10mm; font-weight: bold; }
    .sub { margin-left: 4mm; font-size: 0.9em; }
    .note { font-style: italic; margin-left: 10mm; }
    .total { font-size: 1.3em; font-weight: bold; }
    .big { font-size: 1.4em; font-weight: bold; }
  `;
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
