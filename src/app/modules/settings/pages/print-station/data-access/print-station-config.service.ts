import { Injectable, signal } from '@angular/core';
import { DEFAULT_TICKET_TEXT_SIZE, PaperWidth, TicketTextSize } from 'src/app/shared/utils/printing';

export type PrintStationConfig = Readonly<{
  printerId: number | null;
  paperWidth: PaperWidth;
  // Tamaño del texto de precuenta, comprobante y comanda en este equipo.
  textSize: TicketTextSize;
  // Imprime el comprobante de pago al terminar de cobrar una cuenta.
  autoPaymentReceipt: boolean;
  enabled: boolean;
}>;

const STORAGE_KEY = 'redom.print-station';
const DEFAULT_CONFIG: PrintStationConfig = { printerId: null, paperWidth: 80, textSize: DEFAULT_TICKET_TEXT_SIZE, autoPaymentReceipt: true, enabled: false };

// Configuración propia de este equipo: cada PC/tablet atiende su propia impresora.
@Injectable({ providedIn: 'root' })
export class PrintStationConfigService {
  readonly $config = signal<PrintStationConfig>(this.#restore());

  update(changes: Partial<PrintStationConfig>) {
    const next = { ...this.$config(), ...changes };
    this.$config.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento, la configuración dura hasta recargar.
    }
  }

  #restore(): PrintStationConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_CONFIG, ...(JSON.parse(stored) as Partial<PrintStationConfig>) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}
