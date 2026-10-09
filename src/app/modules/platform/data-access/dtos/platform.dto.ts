/** Panel del superadmin (#47, fase 3). Backend: libs/billing/platform/src/lib/platform.types.ts. */
import {
  EntitlementsDto,
  PlanFeatureCode,
  PlanLimitCode,
  SubscriptionStatus,
} from 'src/app/core/services/entitlements';
import { BillingPaymentMethod, InvoiceStatus, InvoiceWithPaymentsDto } from 'src/app/modules/billing/data-access/dtos';

export type PlanInterval = 'month' | 'year';
export type BillingMethod = 'none' | 'flow' | 'manual';
export type DiscountType = 'percent' | 'amount';
export type DiscountDuration = 'once' | 'repeating' | 'forever';
export type PlanLimitsDto = Readonly<Record<PlanLimitCode, number | null>>;
export type PlanRefDto = Readonly<{ id: number; code: string; name: string }>;

// --- Planes ---

export type PlatformPlanPriceDto = Readonly<{
  id: number;
  interval: PlanInterval;
  amount: number;
  currency: string;
  isActive: boolean;
  flowPlanId: string | null;
  createdAt: string;
  /** Suscripciones vigentes con este precio. */
  subscriptions: number;
}>;

export type PlatformPlanDto = Readonly<{
  id: number;
  code: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isFree: boolean;
  isHighlighted: boolean;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** Primero los vigentes y después el historial. */
  prices: PlatformPlanPriceDto[];
  features: PlanFeatureCode[];
  limits: PlanLimitsDto;
  /** Suscripciones vigentes (trialing, active, past_due). */
  subscriptions: number;
}>;

/** `code` solo al crear (minúsculas, números y guiones; no cambia después). */
export type SavePlanDto = Readonly<{
  code?: string;
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  isFree?: boolean;
  isHighlighted?: boolean;
  isActive?: boolean;
}>;

export type PlatformFeatureDto = Readonly<{
  code: PlanFeatureCode;
  name: string;
  description: string | null;
  moduleCodes: string[];
  position: number;
  /** Códigos de los planes que la incluyen. */
  plans: string[];
}>;

// --- Descuentos ---

export type DiscountDto = Readonly<{
  id: number;
  /** Cupón que escribe el dueño (mayúsculas); null = solo lo asigna el superadmin. */
  code: string | null;
  name: string;
  type: DiscountType;
  value: number;
  duration: DiscountDuration;
  durationPeriods: number | null;
  planIds: number[] | null;
  intervals: PlanInterval[] | null;
  businessIds: number[] | null;
  maxRedemptions: number | null;
  redemptions: number;
  validFrom: string | null;
  validUntil: string | null;
  flowCouponId: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  /** Suscripciones que lo tienen ahora. */
  subscriptions: number;
}>;

/** Ya usado: no se pueden cambiar type, value, duration ni durationPeriods (409 DISCOUNT_IN_USE). */
export type SaveDiscountDto = Readonly<{
  code?: string | null;
  name?: string;
  type?: DiscountType;
  value?: number;
  duration?: DiscountDuration;
  durationPeriods?: number | null;
  planIds?: number[] | null;
  intervals?: PlanInterval[] | null;
  businessIds?: number[] | null;
  maxRedemptions?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
}>;

export type DiscountFiltersDto = Readonly<{ search?: string; isActive?: boolean; page?: number; perPage?: number }>;

// --- Ajustes ---

export type BankTransferInfoDto = Readonly<{
  bank: string | null;
  accountType: string | null;
  accountNumber: string | null;
  holderName: string | null;
  holderTaxId: string | null;
  email: string | null;
}>;

export type PlatformSettingsDto = Readonly<{
  trialDays: number;
  trialPlanCode: string;
  trialRequiresCard: boolean;
  graceDays: number;
  fallbackPlanCode: string;
  reminderDaysBefore: number[];
  bankTransferInfo: BankTransferInfoDto;
  updatedAt: string | null;
}>;

/** Solo cambian los campos enviados; en bankTransferInfo, null borra uno. */
export type UpdatePlatformSettingsDto = Readonly<
  Partial<Omit<PlatformSettingsDto, 'updatedAt' | 'bankTransferInfo'>> & {
    bankTransferInfo?: Partial<BankTransferInfoDto>;
  }
>;

// --- Negocios ---

export type BusinessOwnerDto = Readonly<{ code: string; name: string | null; email: string | null }>;

export type PlatformBusinessItemDto = Readonly<{
  id: number;
  name: string;
  taxNumber: string | null;
  createdAt: string;
  owner: BusinessOwnerDto | null;
  plan: PlanRefDto | null;
  /** null: sin suscripción (usa el plan de respaldo). */
  status: SubscriptionStatus | null;
  billingMethod: BillingMethod | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  /** Cobros vencidos sin pagar (CLP). */
  overdueAmount: number;
  locations: number;
  users: number;
}>;

export type PlatformBusinessFiltersDto = Readonly<{
  search?: string;
  status?: SubscriptionStatus | 'none';
  planId?: number;
  overdue?: boolean;
  trialEndingInDays?: number;
  page?: number;
  perPage?: number;
}>;

export type SubscriptionDetailDto = Readonly<{
  id: number;
  plan: PlanRefDto;
  price: Readonly<{ id: number; interval: PlanInterval; amount: number }> | null;
  status: SubscriptionStatus;
  billingMethod: BillingMethod;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlan: PlanRefDto | null;
  discount: Readonly<{ id: number; code: string | null; name: string; type: DiscountType; value: number; duration: DiscountDuration }> | null;
  discountPeriodsLeft: number | null;
  card: Readonly<{ brand: string | null; last4: string | null; registeredAt: string | null }> | null;
  billingEmail: string | null;
  billingTaxId: string | null;
  flowSubscriptionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type InvoiceDto = Readonly<{
  id: number;
  kind: 'period' | 'proration';
  planId: number;
  priceId: number;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'void';
  paidAt: string | null;
  createdAt: string;
}>;

export type PaymentDto = Readonly<{
  id: number;
  invoiceId: number;
  kind: 'payment' | 'refund' | 'reversal';
  method: 'flow_card' | 'flow_other' | 'transfer' | 'cash' | 'other';
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  paidAt: string | null;
  reference: string | null;
  receiptFileId: string | null;
  comment: string | null;
  reversesPaymentId: number | null;
  createdAt: string;
}>;

export type OverrideDto = Readonly<{
  id: number;
  businessId: number;
  featureCode: PlanFeatureCode | null;
  limitCode: PlanLimitCode | null;
  limitValue: number | null;
  reason: string;
  expiresAt: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}>;

export type BillingEventDto = Readonly<{
  id: number;
  actorCode: string | null;
  actorName: string | null;
  actorRole: 'owner' | 'superadmin' | 'system';
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}>;

/** Lectura auditada (muestra datos de cobro). */
export type PlatformBusinessDetailDto = Readonly<{
  business: Readonly<{ id: number; name: string; taxNumber: string | null; timeZone: string; createdAt: string; owner: BusinessOwnerDto | null }>;
  subscription: SubscriptionDetailDto | null;
  entitlements: EntitlementsDto;
  invoices: InvoiceDto[];
  payments: PaymentDto[];
  /** Todas, también las vencidas (isActive). */
  overrides: OverrideDto[];
  /** Los últimos 50. */
  events: BillingEventDto[];
}>;

/** Si el negocio no tiene suscripción, la crea. */
export type UpdateSubscriptionDto = Readonly<{
  planId?: number;
  priceId?: number | null;
  status?: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  notes?: string | null;
}>;

/** featureCode y/o limitCode; con limitCode, limitValue es obligatorio (null = ilimitado). */
export type CreateOverrideDto = Readonly<{
  featureCode?: PlanFeatureCode;
  limitCode?: PlanLimitCode;
  limitValue?: number | null;
  reason: string;
  expiresAt?: string | null;
}>;

// --- Resumen ---

export type PlatformSummaryDto = Readonly<{
  businesses: Readonly<{ total: number; trialing: number; active: number; pastDue: number; expired: number; free: number }>;
  trialsEndingThisWeek: number;
  mrr: number;
  arr: number;
  revenueThisMonth: number;
  overdueAmount: number;
  churnLastMonth: number;
}>;

// --- Cobros y pagos (fase 4) ---

export type PlatformInvoiceDto = InvoiceWithPaymentsDto & Readonly<{ business: Readonly<{ id: number; name: string; taxNumber: string | null }> }>;

/** from/to: YYYY-MM-DD (fecha de creación, America/Santiago). pendingReview: transferencias por revisar. */
export type PlatformInvoiceFiltersDto = Readonly<{
  status?: InvoiceStatus;
  businessId?: number;
  from?: string;
  to?: string;
  method?: BillingPaymentMethod;
  pendingReview?: boolean;
  page?: number;
  perPage?: number;
}>;

/** Pago recibido por otro medio (queda confirmado). receiptFileId: un comprobante subido por el negocio. */
export type RegisterPaymentDto = Readonly<{
  method: 'transfer' | 'cash' | 'other';
  amount: number;
  paidAt: string;
  reference?: string | null;
  receiptFileId?: string | null;
  comment?: string | null;
}>;
