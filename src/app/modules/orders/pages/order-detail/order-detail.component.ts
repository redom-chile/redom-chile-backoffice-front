import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { HttpStatusCode } from '@angular/common/http';
import { ButtonComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import { getOrderErrorMessage, GetServiceStaffService } from '../order-list/data-access';
import {
  formatDateTime,
  formatRelative,
  KITCHEN_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  StatusBadgeComponent,
} from '../order-list/ui';
import {
  GetOrderByIdService,
  MarkLineServedService,
  MarkOrderServedService,
  modifierLabel,
  OrderDetailDto,
  OrderLineDto,
  orderVariationLabel,
} from './data-access';
import {
  CancelOrderModalComponent,
  CollectPaymentModalComponent,
  CollectPaymentResult,
  OrderLinesTableComponent,
  OrderModalResult,
  UpdateOrderModalComponent,
} from './features';
import { GetOrderPaymentsService, PaymentDto } from 'src/app/modules/payments/pages/payment-list/data-access';
import { FindMyBusinessesService } from 'src/app/modules/restaurante/pages/business/data-access';
import { PrintStationConfigService } from 'src/app/modules/settings/pages/print-station/data-access';
import { billTicketHtml, printHtml } from 'src/app/shared/utils/printing';
import {
  PaymentsTableComponent,
  VoidPaymentModalComponent,
  VoidPaymentResult,
} from 'src/app/modules/payments/pages/payment-list/features';
import { OrderTotalsComponent } from './ui';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    OrderLinesTableComponent,
    OrderTotalsComponent,
    PaymentsTableComponent,
  ],
  templateUrl: './order-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly getByIdService = inject(GetOrderByIdService);
  private readonly markOrderService = inject(MarkOrderServedService);
  private readonly markLineService = inject(MarkLineServedService);
  private readonly staffService = inject(GetServiceStaffService);
  private readonly paymentsService = inject(GetOrderPaymentsService);
  private readonly businessesService = inject(FindMyBusinessesService);
  private readonly printConfig = inject(PrintStationConfigService);

  readonly kitchenStatus = KITCHEN_STATUS;
  readonly orderStatus = ORDER_STATUS;
  readonly paymentStatus = PAYMENT_STATUS;
  readonly formatDateTime = formatDateTime;
  readonly formatRelative = formatRelative;

  readonly $orderId = signal<number | null>(null);
  readonly $pendingLineId = signal<number | null>(null);

  // El servicio es global: se ignora un pedido anterior mientras carga el actual.
  readonly $order = computed(() => {
    const order = this.getByIdService.$order();
    return order && order.transactionId === this.$orderId() ? order : null;
  });
  readonly $isLoading = computed(() => (this.getByIdService.$isLoading() ?? false) && !this.$order());
  readonly $error = this.getByIdService.$error;
  readonly $notFound = computed(() => this.$error() === HttpStatusCode.NotFound || this.$orderId() === null);
  readonly $errorMessage = computed(() => {
    const status = this.$error();
    return status ? getOrderErrorMessage(status) : null;
  });

  readonly $isOpen = computed(() => this.$order()?.status === 'ORDERED');
  readonly $canServe = computed(() => this.$isOpen() && !!this.$order()?.isKitchenOrder);
  readonly $hasPendingLines = computed(() =>
    (this.$order()?.lines ?? []).some((line) => line.resLineOrderStatus !== 'served'),
  );
  readonly $payments = computed(() => {
    const result = this.paymentsService.$payments();
    return result && result.transactionId === this.$orderId() ? result.payments : [];
  });
  readonly $isLoadingPayments = computed(() => this.paymentsService.$isLoading() ?? false);
  readonly $canCollect = computed(() => this.$isOpen() && (this.$order()?.remaining ?? 0) > 0);

  readonly $isMarkingOrder = computed(() => this.markOrderService.$isLoading() ?? false);

  constructor() {
    effect(() => {
      if (this.markOrderService.$success()) {
        this.toast.show('Pedido marcado como servido', 'success');
        this.markOrderService.reset();
        this.getByIdService.retry();
      }
    });

    effect(() => {
      if (this.markLineService.$success()) {
        this.$pendingLineId.set(null);
        this.markLineService.reset();
        this.getByIdService.retry();
      }
    });

    effect(() => {
      const status = this.markOrderService.$error() ?? this.markLineService.$error();
      if (status) {
        this.$pendingLineId.set(null);
        this.toast.show(getOrderErrorMessage(status), 'error');
      }
    });
  }

  ngOnInit(): void {
    this.staffService.load();
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (Number.isInteger(id) && id > 0) {
      this.$orderId.set(id);
      this.getByIdService.load(id);
      this.paymentsService.load(id);
    }
  }

  ngOnDestroy(): void {
    this.markOrderService.reset();
    this.markLineService.reset();
  }

  handleRetry() {
    this.getByIdService.retry();
    this.paymentsService.retry();
  }

  async handlePrintBill(order: OrderDetailDto) {
    const html = billTicketHtml({
      businessName: this.businessesService.$businesses()?.[0]?.name ?? 'REDOM',
      invoiceNo: order.invoiceNo,
      tableName: order.tableName,
      waiterName: order.waiterName,
      lines: order.lines.map((line) => {
        const variation = orderVariationLabel(line.variationName);
        return {
          name: variation ? `${line.productName} (${variation})` : line.productName,
          quantity: line.quantity,
          // Incluye los modificadores.
          total: line.lineTotal,
          modifiers: (line.modifiers ?? []).map((modifier) => modifierLabel(line, modifier)),
        };
      }),
      subtotal: order.totalBeforeTax,
      discount: order.totalBeforeTax - order.finalTotal,
      total: order.finalTotal,
      taxAmount: order.taxAmount,
      paid: order.totalPaid,
      remaining: order.remaining,
      suggestedTipPercent: 10,
    });
    try {
      await printHtml(html, this.printConfig.$config().paperWidth);
    } catch {
      this.toast.show('No se pudo imprimir la precuenta', 'error');
    }
  }

  handleCollect(order: OrderDetailDto) {
    this.dialog
      .open<CollectPaymentModalComponent, OrderDetailDto, CollectPaymentResult>(CollectPaymentModalComponent, {
        width: '600px',
        maxWidth: '95vw',
        disableClose: true,
        data: order,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'dismissed' || !result) return;
        if (result === 'paid') this.toast.show('Cuenta pagada y cerrada', 'success');
        this.handleRetry();
      });
  }

  handleVoidPayment(payment: PaymentDto) {
    this.dialog
      .open<VoidPaymentModalComponent, PaymentDto, VoidPaymentResult>(VoidPaymentModalComponent, {
        width: '520px',
        maxWidth: '95vw',
        disableClose: true,
        data: payment,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result !== 'voided') return;
        this.toast.show('Pago anulado', 'success');
        this.handleRetry();
      });
  }

  handleServeLine(line: OrderLineDto) {
    this.$pendingLineId.set(line.lineId);
    this.markLineService.markLine(line.lineId);
  }

  handleServeAll(order: OrderDetailDto) {
    this.markOrderService.markOrder(order.transactionId);
  }

  handleAddItems(order: OrderDetailDto) {
    this.router.navigate(['/orders', order.transactionId, 'add']);
  }

  handleEdit(order: OrderDetailDto) {
    this.dialog
      .open<UpdateOrderModalComponent, OrderDetailDto, OrderModalResult>(UpdateOrderModalComponent, {
        width: '640px',
        maxWidth: '95vw',
        disableClose: true,
        data: order,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  handleCancelOrder(order: OrderDetailDto) {
    this.dialog
      .open<CancelOrderModalComponent, OrderDetailDto, OrderModalResult>(CancelOrderModalComponent, {
        width: '500px',
        maxWidth: '95vw',
        disableClose: true,
        data: order,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  private handleModalResult(result: OrderModalResult | undefined) {
    const messages: Partial<Record<OrderModalResult, string>> = {
      updated: 'Pedido actualizado',
      'cancelled-order': 'Pedido cancelado',
    };
    const message = result ? messages[result] : undefined;
    if (!message) return;
    this.toast.show(message, 'success');
    this.handleRetry();
  }
}
