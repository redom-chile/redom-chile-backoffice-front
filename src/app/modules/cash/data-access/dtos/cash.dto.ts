import { PaymentMethod } from 'src/app/modules/payments/pages/payment-list/data-access/dtos/payment.dto';

export type { PaymentMethod };
export type CashSessionStatus = 'open' | 'closed';
// opening, sale y cash_in suman; refund, cash_out y expense restan (el monto siempre viene positivo).
export type CashMovementType = 'opening' | 'sale' | 'refund' | 'cash_in' | 'cash_out' | 'expense';

// ---------- Cajas: /cash/registers ----------
export type CashRegisterOpenSessionDto = Readonly<{
  id: number;
  openedAt: string;
  openedBy: string | null;
  openedByName: string | null;
}>;

export type CashRegisterDto = Readonly<{
  id: number;
  locationId: number;
  locationName: string;
  name: string;
  isActive: boolean;
  openSession: CashRegisterOpenSessionDto | null;
}>;

export type CashRegisterFiltersDto = Readonly<{ locationId?: number; includeInactive?: boolean }>;
export type CreateCashRegisterDto = Readonly<{ locationId: number; name: string }>;
export type UpdateCashRegisterDto = Readonly<{ name?: string; isActive?: boolean }>;

// ---------- Turnos: /cash/sessions ----------
export type OpenCashSessionDto = Readonly<{ registerId: number; openingAmount: number }>;

export type CreateCashMovementDto = Readonly<{
  type: 'cash_in' | 'cash_out';
  // > 0
  amount: number;
  // Obligatorio, máx. 255.
  reason: string;
}>;

export type CashMovementResultDto = Readonly<{
  id: number;
  sessionId: number;
  type: string;
  amount: number;
  reason: string | null;
  createdAt: string;
}>;

export type CashDenominationDto = Readonly<{ value: number; quantity: number }>;

export type CashCountInputDto = Readonly<{
  method: PaymentMethod;
  // counted o denominations (si van ambos, deben coincidir).
  counted?: number;
  denominations?: CashDenominationDto[];
}>;

export type CloseCashSessionDto = Readonly<{
  // El efectivo es obligatorio; los otros medios, opcionales. Sin medios repetidos.
  counts: CashCountInputDto[];
  notes?: string | null;
}>;

export type CashTotalsDto = Readonly<{
  openingAmount: number;
  salesCount: number;
  // Sin propina.
  sales: number;
  tips: number;
  refundsCount: number;
  // Con propina.
  refunds: number;
  cashIn: number;
  cashOut: number;
  expenses: number;
}>;

export type CashMethodSummaryDto = Readonly<{
  method: PaymentMethod;
  salesCount: number;
  sales: number;
  tips: number;
  refundsCount: number;
  refunds: number;
  expected: number;
  // null mientras el turno está abierto o si no se contó.
  counted: number | null;
  // contado − esperado: negativa = faltante, positiva = sobrante.
  difference: number | null;
  denominations: CashDenominationDto[] | null;
}>;

export type CashMovementDto = Readonly<{
  id: number;
  type: CashMovementType;
  method: PaymentMethod;
  // Siempre positivo: el tipo da el signo.
  amount: number;
  tipAmount: number;
  reason: string | null;
  paymentId: number | null;
  transactionId: number | null;
  invoiceNo: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}>;

/** Turno con su reporte Z. Turno abierto y usuario que no es el dueño: detailVisible false y el detalle en null. */
export type CashSessionDto = Readonly<{
  id: number;
  status: CashSessionStatus;
  registerId: number;
  registerName: string;
  locationId: number;
  locationName: string;
  // Siempre viene, aunque detailVisible sea false.
  openingAmount: number;
  openedBy: string | null;
  openedByName: string | null;
  openedAt: string;
  closedBy: string | null;
  closedByName: string | null;
  closedAt: string | null;
  notes: string | null;
  detailVisible: boolean;
  totals: CashTotalsDto | null;
  methods: CashMethodSummaryDto[] | null;
  cashExpected: number | null;
  cashCounted: number | null;
  cashDifference: number | null;
  movements: CashMovementDto[] | null;
}>;

export type CurrentCashSessionDto = Readonly<{ session: CashSessionDto | null }>;

export type CashSessionFiltersDto = Readonly<{
  locationId?: number;
  registerId?: number;
  status?: CashSessionStatus;
  // YYYY-MM-DD en la zona del negocio (fecha de apertura).
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  // Máx. 100 (el backend no acepta `limit`).
  perPage?: number;
}>;

export type CashSessionListItemDto = Readonly<{
  id: number;
  status: CashSessionStatus;
  registerId: number;
  registerName: string;
  locationId: number;
  locationName: string;
  openingAmount: number;
  openedAt: string;
  openedByName: string | null;
  closedAt: string | null;
  closedByName: string | null;
  // null en turnos abiertos para quien no es dueño.
  sales: number | null;
  // null en todos los turnos abiertos.
  cashExpected: number | null;
  cashCounted: number | null;
  cashDifference: number | null;
}>;
