import { PaymentMethod } from './finance.dto';

// individual: cada mesero sus propinas (las sin mesero en partes iguales); equal: todo en partes iguales; points: según puntos.
export type TipDistributionMode = 'individual' | 'equal' | 'points';

// ---------- Propinas pendientes: GET /tips/pending ----------
export type TipsPeriodFiltersDto = Readonly<{
  // YYYY-MM-DD (fecha del pago, zona del negocio). Sin dateFrom: todas las pendientes hasta dateTo (hoy).
  dateFrom?: string;
  dateTo?: string;
  locationId?: number;
}>;

export type PendingTipsDto = Readonly<{
  dateFrom: string | null;
  dateTo: string;
  total: number;
  payments: number;
  byWaiter: ReadonlyArray<{ userCode: string; name: string | null; tips: number; payments: number }>;
  // Propinas de pedidos sin mesero.
  unassigned: Readonly<{ tips: number; payments: number }>;
}>;

// ---------- Liquidación: POST /tips/payouts/preview y POST /tips/payouts ----------
export type TipParticipantDto = Readonly<{
  // `code` del usuario del negocio.
  userCode: string;
  // Solo en modo points (≥ 0, 2 decimales; por defecto 1).
  points?: number;
}>;

export type TipDistributionRequestDto = TipsPeriodFiltersDto &
  Readonly<{
    // Por defecto, el modo del negocio.
    mode?: TipDistributionMode;
    // points: obligatorio. equal: por defecto los meseros con propinas. individual: suma gente que comparte las sin mesero.
    participants?: TipParticipantDto[];
  }>;

export type CreateTipPayoutDto = TipDistributionRequestDto &
  Readonly<{
    method: PaymentMethod;
    // Efectivo con la caja activa: caja de donde sale (o la única abierta del local).
    cashRegisterId?: number;
    reference?: string;
    note?: string;
    // ISO; por defecto ahora.
    paidAt?: string;
  }>;

export type TipPayoutLineDto = Readonly<{
  userCode: string;
  name: string | null;
  ownTips: number;
  points: number;
  // Redondeado a la moneda; las líneas suman el total exacto.
  amount: number;
}>;

export type TipDistributionDto = Readonly<{
  mode: TipDistributionMode;
  dateFrom: string | null;
  dateTo: string;
  total: number;
  payments: number;
  lines: TipPayoutLineDto[];
}>;

export type TipPayoutDto = TipDistributionDto &
  Readonly<{
    id: number;
    locationId: number | null;
    locationName: string | null;
    method: PaymentMethod;
    reference: string | null;
    note: string | null;
    cashSessionId: number | null;
    paidAt: string;
    createdBy: string | null;
    createdByName: string | null;
    createdAt: string;
    cancelled: boolean;
    cancelledAt: string | null;
    cancellationReason: string | null;
  }>;

// ---------- Historial: GET /tips/payouts ----------
export type TipPayoutFiltersDto = Readonly<{
  locationId?: number;
  // Fecha de pago de la liquidación.
  dateFrom?: string;
  dateTo?: string;
  includeCancelled?: boolean;
  page?: number;
  // Máx. 100 (el backend no acepta `limit`).
  perPage?: number;
}>;

export type TipPayoutListItemDto = Readonly<{
  id: number;
  paidAt: string;
  dateFrom: string | null;
  dateTo: string;
  locationId: number | null;
  locationName: string | null;
  mode: TipDistributionMode;
  total: number;
  method: PaymentMethod;
  people: number;
  createdByName: string | null;
  cancelled: boolean;
}>;

// ---------- Comisiones: /payments/method-settings ----------
export type PaymentMethodSettingDto = Readonly<{
  method: PaymentMethod;
  // 0..100, hasta 4 decimales.
  feePercent: number;
  // Por transacción, ≥ 0.
  feeFixed: number;
  // Se suma IVA a la comisión.
  feeVat: boolean;
  // 0..90 días hasta el abono.
  settlementDays: number;
  // true: solo lunes a viernes (sin feriados).
  businessDays: boolean;
  configured: boolean;
}>;

export type UpdatePaymentMethodSettingDto = Partial<Omit<PaymentMethodSettingDto, 'method' | 'configured'>>;

// ---------- Plata por llegar: GET /payments/settlements ----------
export type SettlementFiltersDto = Readonly<{
  // Fecha de los pagos; por defecto, últimos 30 días.
  dateFrom?: string;
  dateTo?: string;
  locationId?: number;
  method?: PaymentMethod;
}>;

export type SettlementTotalsDto = Readonly<{
  payments: number;
  gross: number;
  fees: number;
  net: number;
  // Neto con fecha de abono posterior a hoy.
  pendingNet: number;
  settledNet: number;
}>;

export type SettlementsDto = Readonly<{
  dateFrom: string;
  dateTo: string;
  today: string;
  totals: SettlementTotalsDto;
  byMethod: ReadonlyArray<SettlementTotalsDto & { method: PaymentMethod }>;
  bySettlementDate: ReadonlyArray<{
    date: string;
    method: PaymentMethod;
    payments: number;
    gross: number;
    fees: number;
    net: number;
    // date <= hoy.
    settled: boolean;
  }>;
}>;
