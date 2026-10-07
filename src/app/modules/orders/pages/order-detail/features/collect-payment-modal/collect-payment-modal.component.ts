import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';
import { CashDeviceStore, CashService } from 'src/app/modules/cash/data-access';
import { openCashSessionModal } from 'src/app/modules/cash/features/open-session-modal';
import { CashContextStore, openRegisterPicker } from 'src/app/modules/cash/features/cash-panel';
import {
  CreatePaymentDto,
  CreatePaymentService,
  getPaymentErrorMessage,
  PaymentLineInputDto,
  PaymentMethod,
} from 'src/app/modules/payments/pages/payment-list/data-access';
import {
  formatQuantity,
  PAYMENT_METHODS,
  paymentLinesLabel,
  paymentMethodLabel,
} from 'src/app/modules/payments/pages/payment-list/ui';
import { BusinessSettingsService, roundCurrency } from 'src/app/core/services/business-settings';
import { FindMyBusinessesService } from 'src/app/modules/restaurante/pages/business/data-access';
import { PrintStationConfigService } from 'src/app/modules/settings/pages/print-station/data-access';
import { billTicketHtml, printHtml } from 'src/app/shared/utils/printing';
import { formatCurrency } from '../../../order-list/ui';
import { GetOrderByIdService, modifierLabel, OrderDetailDto, OrderLineDto, orderVariationLabel } from '../../data-access';

export type CollectPaymentResult = 'paid' | 'partial' | 'dismissed';

type CollectMode = 'amount' | 'products';
type RegisteredPayment = Readonly<{ method: PaymentMethod; amount: number; tip: number; change: number; products: string }>;

type TipOption = Readonly<{ label: string; percent: number | null }>;

// Chips de propina: la sugerida del negocio, 15 % si es distinta y "Otro" (percent null = monto manual).
function tipOptions(suggested: number): TipOption[] {
  const options: TipOption[] = [{ label: 'Sin propina', percent: 0 }];
  if (suggested > 0) options.push({ label: `${suggested.toLocaleString('es-CL')} %`, percent: suggested });
  if (suggested !== 15) options.push({ label: '15 %', percent: 15 });
  options.push({ label: 'Otro', percent: null });
  return options;
}
const CASH_BILLS = [5000, 10000, 20000];

// Los productos por peso (0,5 kg) admiten decimales; el resto se paga por unidades.
const isDecimalLine = (line: OrderLineDto) => !Number.isInteger(line.quantity);
const roundQuantity = (line: OrderLineDto, value: number) =>
  isDecimalLine(line) ? Math.round(value * 10_000) / 10_000 : Math.floor(value);

@Component({
  selector: 'app-collect-payment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './collect-payment-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectPaymentModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<CollectPaymentModalComponent, CollectPaymentResult>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly paymentService = inject(CreatePaymentService);
  private readonly orderService = inject(GetOrderByIdService);
  private readonly businessesService = inject(FindMyBusinessesService);
  private readonly printConfig = inject(PrintStationConfigService);
  private readonly businessSettings = inject(BusinessSettingsService);
  private readonly dialog = inject(MatDialog);
  private readonly cashService = inject(CashService);
  private readonly cashDevice = inject(CashDeviceStore);
  private readonly cashContext = inject(CashContextStore);
  // Último pago enviado: se reintenta igual tras abrir la caja o elegir una.
  private lastRequest: CreatePaymentDto | null = null;

  readonly methods = PAYMENT_METHODS;
  // Propina sugerida del negocio (10 si la configuración no llegó; 0 = sin sugerencia).
  readonly $suggestedTipPercent = this.businessSettings.$suggestedTipPercent;
  readonly $tipOptions = computed(() => tipOptions(this.$suggestedTipPercent()));
  // Porcentaje activo; null cuando la propina se ingresó a mano.
  readonly $tipPercent = signal<number | null>(this.$suggestedTipPercent());
  // Si la configuración llega con el modal abierto, se respeta lo que el cajero ya eligió.
  private tipTouched = false;
  readonly formatCurrency = formatCurrency;
  readonly formatQuantity = formatQuantity;
  readonly methodLabel = paymentMethodLabel;
  readonly modifierLabel = modifierLabel;
  readonly variationLabel = orderVariationLabel;
  readonly isDecimalLine = isDecimalLine;

  // Se recarga tras cada pago por productos para conocer lo pendiente de cada línea.
  readonly $order = signal(inject<OrderDetailDto>(MAT_DIALOG_DATA));
  readonly $remaining = signal(this.$order().remaining);
  readonly $registered = signal<RegisteredPayment[]>([]);
  // Último pago en efectivo con vuelto: se muestra destacado hasta continuar.
  readonly $lastChange = signal<RegisteredPayment | null>(null);
  readonly $isLoading = computed(() => this.paymentService.$isLoading() ?? false);

  readonly $mode = signal<CollectMode>('amount');
  // lineId → cantidad elegida.
  readonly $selection = signal<Readonly<Record<number, number>>>({});
  readonly $showPaid = signal(false);
  // Pedido vigente al pedir la recarga: se espera uno nuevo.
  readonly $reloadingFrom = signal<OrderDetailDto | null | undefined>(undefined);
  readonly $isReloading = computed(() => this.$reloadingFrom() !== undefined);

  // Un backend sin pagos por producto no informa lo pendiente de cada línea.
  readonly $supportsProducts = computed(() => this.$order().lines.some((line) => line.pendingQuantity !== undefined));
  readonly $pendingLines = computed(() => this.$order().lines.filter((line) => (line.pendingQuantity ?? 0) > 0));
  readonly $paidLines = computed(() =>
    this.$order().lines.filter((line) => line.pendingQuantity !== undefined && line.pendingQuantity <= 0),
  );
  readonly $selectedLines = computed(() => {
    const selection = this.$selection();
    return this.$pendingLines().filter((line) => (selection[line.lineId] ?? 0) > 0);
  });
  // Estimación: el monto exacto (modificadores y descuento proporcional) lo calcula el backend.
  readonly $preview = computed(() =>
    this.$selectedLines().reduce((sum, line) => sum + this.linePreview(line, this.$selection()[line.lineId] ?? 0), 0),
  );
  readonly $allSelected = computed(() => {
    const selection = this.$selection();
    const pending = this.$pendingLines();
    return pending.length > 0 && pending.every((line) => selection[line.lineId] === line.pendingQuantity);
  });

  readonly form = inject(FormBuilder).nonNullable.group({
    method: ['cash' as PaymentMethod],
    amount: [this.$order().remaining],
    tipAmount: [0],
    amountTendered: [null as number | null],
    note: [''],
  });

  readonly $value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly $byProducts = computed(() => this.$mode() === 'products');
  readonly $isCash = computed(() => this.$value().method === 'cash');
  readonly $amount = computed(() => (this.$byProducts() ? this.$preview() : Number(this.$value().amount) || 0));
  readonly $tip = computed(() => Number(this.$value().tipAmount) || 0);
  readonly $due = computed(() => this.$amount() + this.$tip());
  readonly $tendered = computed(() => Number(this.$value().amountTendered) || 0);
  readonly $change = computed(() => (this.$isCash() && this.$tendered() > 0 ? this.$tendered() - this.$due() : 0));
  readonly $cashOptions = computed(() => {
    const due = this.$due();
    return [due, ...CASH_BILLS.map((bill) => Math.ceil(due / bill) * bill)].filter(
      (value, index, list) => value > 0 && list.indexOf(value) === index,
    );
  });
  readonly $isPaid = computed(() => this.$remaining() <= 0);

  // La interfaz impide pagar más que el saldo (el backend también lo valida).
  readonly $validationError = computed(() => {
    if (this.$byProducts()) {
      if (!this.$selectedLines().length) return 'Selecciona los productos a pagar';
      if (this.$isReloading()) return 'Actualizando la cuenta…';
    } else {
      const amount = this.$amount();
      if (amount <= 0) return 'Ingresa el monto a pagar';
      if (amount > this.$remaining()) return `El monto no puede superar el saldo (${formatCurrency(this.$remaining())})`;
    }
    if (this.$tip() < 0) return 'La propina no puede ser negativa';
    if (!this.$byProducts() && this.$isCash() && this.$tendered() > 0 && this.$tendered() < this.$due())
      return 'El efectivo recibido no cubre el monto más la propina';
    return null;
  });

  // Avisos del pago por productos: el monto es estimado, el backend tiene la última palabra.
  readonly $productsWarning = computed(() => {
    if (!this.$byProducts() || !this.$selectedLines().length) return null;
    if (this.$preview() > this.$remaining())
      return 'Los productos superan el saldo porque hubo pagos por monto. Cobra el resto con "Por monto".';
    if (this.$isCash() && this.$tendered() > 0 && this.$tendered() < this.$due())
      return 'El efectivo recibido podría no cubrir el monto estimado más la propina.';
    return null;
  });

  constructor() {
    effect(() => {
      const suggested = this.$suggestedTipPercent();
      if (!this.tipTouched) untracked(() => this.$tipPercent.set(suggested));
    });

    // Con un porcentaje activo la propina sigue al monto (o a la selección de productos).
    effect(() => {
      const percent = this.$tipPercent();
      const amount = this.$amount();
      if (percent === null) return;
      const tip = this.tipFor(amount, percent);
      untracked(() => {
        if ((Number(this.form.controls.tipAmount.value) || 0) !== tip) this.form.patchValue({ tipAmount: tip });
      });
    });

    effect(() => {
      const result = this.paymentService.$result();
      if (!result) return;
      const { request } = result;
      const amount = result.amount ?? request.amount ?? 0;
      const payment: RegisteredPayment = {
        method: request.method,
        amount,
        tip: request.tipAmount ?? 0,
        change: result.changeAmount,
        products: request.lines?.length ? this.productsLabel(request.lines) : '',
      };
      this.$registered.update((list) => [...list, payment]);
      this.$remaining.set(result.remaining);
      this.$lastChange.set(payment.change > 0 ? payment : null);
      this.paymentService.reset();
      this.lastRequest = null;
      if (this.businessSettings.$cashManagementEnabled()) this.cashContext.refresh();
      if (result.remaining > 0) {
        const change = payment.change > 0 ? ` · Vuelto ${formatCurrency(payment.change)}` : '';
        this.toast.show(
          `Pago de ${formatCurrency(amount)} registrado${change}. Saldo: ${formatCurrency(result.remaining)}`,
          'success',
        );
        this.form.reset({
          method: 'cash',
          amount: result.remaining,
          tipAmount: this.tipFor(result.remaining, this.$suggestedTipPercent()),
          amountTendered: null,
          note: '',
        });
        this.$tipPercent.set(this.$suggestedTipPercent());
        this.$selection.set({});
        // Lo pagado por producto (o por monto) cambia lo pendiente de cada línea.
        if (this.$supportsProducts()) this.reloadOrder();
      }
    });

    effect(() => {
      // El modal queda abierto (con el monto ingresado) para reintentar, p. ej. tras registrar stock.
      const error = this.paymentService.$error();
      if (!error) return;
      if (untracked(() => this.handleCashError(error))) return;
      this.toast.show(getPaymentErrorMessage(error), 'error');
      if (!this.$byProducts()) return;
      const lineId = Number(error.details['sellLineId']);
      if (error.code === ApiErrorCode.LINE_ALREADY_PAID && Number.isFinite(lineId)) {
        this.setQuantityById(lineId, Number(error.details['pendingQuantity']) || 0);
      } else if (error.code === ApiErrorCode.INVALID_PAYMENT_LINE && Number.isFinite(lineId)) {
        this.setQuantityById(lineId, 0);
      }
      // Sin código (p. ej. supera el saldo) o con los anteriores: se recarga la cuenta y se ajusta la selección.
      if (error.status === 400) this.reloadOrder();
    });

    effect(() => {
      const from = this.$reloadingFrom();
      if (from === undefined) return;
      const order = this.orderService.$order();
      if (order && order !== from && order.transactionId === this.$order().transactionId) {
        this.$order.set(order);
        this.$remaining.set(order.remaining);
        this.form.patchValue({ amount: order.remaining });
        this.clampSelection();
        this.$reloadingFrom.set(undefined);
      } else if (this.orderService.$isLoading() === false && this.orderService.$error()) {
        this.$reloadingFrom.set(undefined);
      }
    });
  }

  setMode(mode: CollectMode) {
    this.$mode.set(mode);
    this.form.patchValue({ amountTendered: null });
  }

  selectMethod(method: PaymentMethod) {
    this.form.patchValue({ method, amountTendered: null });
  }

  setAmount(amount: number) {
    this.form.patchValue({ amount });
  }

  setHalf() {
    this.setAmount(Math.ceil(this.$remaining() / 2));
  }

  selectTip(percent: number | null, input?: HTMLInputElement) {
    this.tipTouched = true;
    this.$tipPercent.set(percent);
    if (percent === null) input?.focus();
  }

  manualTip() {
    this.tipTouched = true;
    this.$tipPercent.set(null);
  }

  setTendered(value: number) {
    this.form.patchValue({ amountTendered: value });
  }

  // ---- Por productos ----

  quantityOf(line: OrderLineDto): number {
    return this.$selection()[line.lineId] ?? 0;
  }

  // Proporcional a lo pendiente; pagar todo lo pendiente cobra exactamente pendingAmount.
  linePreview(line: OrderLineDto, quantity: number): number {
    const pending = line.pendingQuantity ?? 0;
    if (quantity <= 0 || pending <= 0) return 0;
    return Math.round(((line.pendingAmount ?? 0) * quantity) / pending);
  }

  setQuantity(line: OrderLineDto, value: number) {
    const max = line.pendingQuantity ?? 0;
    const quantity = Math.min(Math.max(roundQuantity(line, Number(value) || 0), 0), max);
    this.$selection.update((selection) => ({ ...selection, [line.lineId]: quantity }));
  }

  step(line: OrderLineDto, delta: number) {
    this.setQuantity(line, this.quantityOf(line) + delta);
  }

  selectAll() {
    this.$selection.set(Object.fromEntries(this.$pendingLines().map((line) => [line.lineId, line.pendingQuantity ?? 0])));
  }

  clearSelection() {
    this.$selection.set({});
  }

  async printPersonBill() {
    const order = this.$order();
    const selection = this.$selection();
    const lines = this.$selectedLines();
    if (!lines.length) return;
    const total = this.$preview();
    const html = billTicketHtml({
      businessName: this.businessesService.$businesses()?.[0]?.name ?? 'REDOM',
      title: 'PRECUENTA POR PERSONA',
      invoiceNo: order.invoiceNo,
      tableName: order.tableName,
      waiterName: order.waiterName,
      lines: lines.map((line) => {
        const variation = orderVariationLabel(line.variationName);
        return {
          name: variation ? `${line.productName} (${variation})` : line.productName,
          quantity: selection[line.lineId],
          total: this.linePreview(line, selection[line.lineId]),
          modifiers: (line.modifiers ?? []).map((modifier) => modifierLabel(line, modifier)),
        };
      }),
      // Los montos ya incluyen el descuento proporcional del pedido.
      subtotal: total,
      discount: 0,
      total,
      taxAmount: order.finalTotal > 0 ? Math.round((order.taxAmount * total) / order.finalTotal) : 0,
      paid: 0,
      remaining: total,
      suggestedTipPercent: this.$suggestedTipPercent(),
      note: 'Montos estimados: el sistema calcula el monto final al cobrar',
    });
    try {
      await printHtml(html, this.printConfig.$config().paperWidth);
    } catch {
      this.toast.show('No se pudo imprimir la precuenta', 'error');
    }
  }

  handleSubmit() {
    const error = this.$validationError();
    if (error) {
      this.toast.show(error, 'warning');
      return;
    }
    const { method, note } = this.form.getRawValue();
    const base = {
      transactionId: this.$order().transactionId,
      method,
      tipAmount: this.$tip() || undefined,
      amountTendered: this.$isCash() && this.$tendered() > 0 ? this.$tendered() : undefined,
      note: note.trim() || undefined,
    };
    // Por productos no se envía el monto: lo calcula el backend (si se envía debe coincidir).
    const dto: CreatePaymentDto = this.$byProducts()
      ? {
          ...base,
          lines: this.$selectedLines().map((line) => ({ sellLineId: line.lineId, quantity: this.quantityOf(line) })),
        }
      : { ...base, amount: this.$amount() };
    this.$lastChange.set(null);
    this.send({ ...dto, cashRegisterId: this.cashRegisterFor(method) });
  }

  private send(dto: CreatePaymentDto) {
    this.lastRequest = dto;
    this.paymentService.create(dto);
  }

  // ---- Caja (solo con el módulo activo) ----

  // Efectivo: la caja del equipo. Otros medios: solo si se sabe abierta (cerrada, el backend exigiría turno).
  private cashRegisterFor(method: PaymentMethod): number | undefined {
    if (!this.businessSettings.$cashManagementEnabled()) return undefined;
    const locationId = this.$order().locationId;
    const inContext = this.cashContext.$locationId() === locationId ? this.cashContext.$register() : null;
    if (method !== 'cash') return inContext?.openSession ? inContext.id : undefined;
    return inContext?.id ?? this.cashDevice.registerFor(locationId) ?? undefined;
  }

  /** true si el error es de caja y ya se atendió. */
  private handleCashError(error: ApiError): boolean {
    const request = this.lastRequest;
    if (!request || !this.businessSettings.$cashManagementEnabled()) return false;
    const locationId = this.$order().locationId;

    if (error.code === ApiErrorCode.CASH_SESSION_REQUIRED) {
      const registerId = Number(error.details['registerId']) || request.cashRegisterId || null;
      this.toast.show('La caja está cerrada: ábrela para cobrar', 'warning');
      openCashSessionModal(this.dialog, {
        locationId,
        registerId,
        message: 'Para registrar este cobro la caja debe estar abierta. Ábrela y se cobrará de inmediato.',
      }).subscribe((opened) => {
        if (opened) this.send({ ...request, cashRegisterId: opened.registerId });
      });
      return true;
    }

    if (error.code === ApiErrorCode.CASH_REGISTER_AMBIGUOUS) {
      const ids = Array.isArray(error.details['registerIds']) ? (error.details['registerIds'] as unknown[]).map(Number) : [];
      this.cashService.getRegisters({ locationId }).subscribe({
        next: (registers) => {
          const options = registers.filter((register) => ids.includes(register.id) || (!ids.length && register.openSession));
          openRegisterPicker(this.dialog, {
            title: '¿Con qué caja cobras?',
            message: 'Hay varias cajas abiertas en este local. Este equipo recordará la que elijas.',
            registers: options,
          }).subscribe((registerId) => {
            if (!registerId) return;
            this.cashDevice.select(locationId, registerId);
            this.send({ ...request, cashRegisterId: registerId });
          });
        },
        error: () => this.toast.show('Hay varias cajas abiertas y no se pudieron cargar. Intenta nuevamente.', 'error'),
      });
      return true;
    }

    // La caja guardada ya no sirve (borrada, desactivada o de otro local): se olvida para elegir otra.
    if (request.cashRegisterId && /cash register (not found|is inactive)|belongs to another location/i.test(error.message)) {
      this.cashDevice.select(locationId, null);
      this.cashContext.refresh();
    }
    return false;
  }

  dismissChange() {
    this.$lastChange.set(null);
  }

  handleClose() {
    const result: CollectPaymentResult = this.$isPaid() ? 'paid' : this.$registered().length ? 'partial' : 'dismissed';
    this.dialogRef.close(result);
  }

  ngOnDestroy(): void {
    this.paymentService.reset();
  }

  // Redondeada a los decimales de la moneda (CLP: 0).
  private tipFor(amount: number, percent: number): number {
    return percent > 0 ? roundCurrency((amount * percent) / 100, this.businessSettings.$currencyPrecision()) : 0;
  }

  private reloadOrder() {
    this.$reloadingFrom.set(this.orderService.$order() ?? null);
    this.orderService.load(this.$order().transactionId);
  }

  private setQuantityById(lineId: number, value: number) {
    const line = this.$order().lines.find((item) => item.lineId === lineId);
    if (line) this.setQuantity({ ...line, pendingQuantity: Math.min(value, line.pendingQuantity ?? 0) }, value);
  }

  // Tras recargar: nada por sobre lo pendiente y fuera lo que ya se pagó.
  private clampSelection() {
    const selection = this.$selection();
    const next: Record<number, number> = {};
    for (const line of this.$pendingLines()) {
      const quantity = Math.min(selection[line.lineId] ?? 0, line.pendingQuantity ?? 0);
      if (quantity > 0) next[line.lineId] = quantity;
    }
    this.$selection.set(next);
  }

  private productsLabel(lines: readonly PaymentLineInputDto[]): string {
    const byId = new Map(this.$order().lines.map((line) => [line.lineId, line.productName]));
    return paymentLinesLabel(lines.map((line) => ({ ...line, productName: byId.get(line.sellLineId) })));
  }
}
