import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { PaymentDto } from 'src/app/modules/payments/pages/payment-list/data-access';
import { paymentMethodLabel } from 'src/app/modules/payments/pages/payment-list/ui/payment-methods';
import { FindMyBusinessesService } from 'src/app/modules/restaurante/pages/business/data-access';
import { PrintStationConfigService } from 'src/app/modules/settings/pages/print-station/data-access';
import { paymentReceiptHtml, printHtml } from 'src/app/shared/utils/printing';
import { modifierLabel, OrderDetailDto, orderVariationLabel, packItemLabel } from '../../data-access';

// Comprobante de pago de una cuenta: lee los pagos vigentes del pedido y lo imprime en este equipo.
@Injectable({ providedIn: 'root' })
export class PaymentReceiptService {
  readonly #http = inject(HttpClient);
  readonly #businessSettings = inject(BusinessSettingsService);
  readonly #businesses = inject(FindMyBusinessesService);
  readonly #printConfig = inject(PrintStationConfigService);

  // Con la impresión automática activada en la Estación de impresión de este equipo.
  get autoPrint(): boolean {
    return this.#printConfig.$config().autoPaymentReceipt !== false;
  }

  async print(order: OrderDetailDto): Promise<void> {
    // Consulta propia: no pisa el listado de pagos que muestra el detalle del pedido.
    const [payments, showTax] = await Promise.all([
      firstValueFrom(
        this.#http.get<PaymentDto[]>(`${ApiPathEnum.RESTAURANT}/payments`, {
          params: new HttpParams().set('transactionId', order.transactionId),
        }),
      ),
      this.#businessSettings.showTaxOnPreBillFor(order.locationId),
    ]);
    const html = paymentReceiptHtml({
      businessName: this.#businesses.$current()?.name ?? 'REDOM',
      invoiceNo: order.invoiceNo,
      tableName: order.tableName,
      waiterName: order.waiterName,
      lines: order.lines.map((line) => {
        const variation = orderVariationLabel(line.variationName);
        return {
          name: variation ? `${line.productName} (${variation})` : line.productName,
          quantity: line.quantity,
          total: line.lineTotal,
          modifiers: [...(line.packItems ?? []).map(packItemLabel), ...(line.modifiers ?? []).map((modifier) => modifierLabel(line, modifier))],
        };
      }),
      subtotal: order.totalBeforeTax,
      discount: order.totalBeforeTax - order.finalTotal,
      total: order.finalTotal,
      taxAmount: order.taxAmount,
      showTax,
      payments: payments
        .filter((payment) => !payment.cancelled)
        .map((payment) => ({
          method: paymentMethodLabel(payment.method),
          amount: payment.amount,
          tip: payment.tipAmount ?? 0,
          tendered: payment.amountTendered,
          change: payment.changeAmount ?? 0,
        })),
    });
    const { paperWidth, textSize } = this.#printConfig.$config();
    await printHtml(html, paperWidth, textSize);
  }
}
