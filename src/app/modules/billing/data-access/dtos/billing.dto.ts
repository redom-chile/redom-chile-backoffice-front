/** Suscripción del dueño y pago manual (#47, fase 4). Backend: libs/billing/payments/src/lib/payments.types.ts. */
import { PlanLimitCode, SubscriptionStatus } from 'src/app/core/services/entitlements';

export type PlanInterval = 'month' | 'year';
export type PlanRef = Readonly<{ id: number; code: string; name: string }>;
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'void';
export type BillingPaymentMethod = 'transfer' | 'cash' | 'other' | 'flow_card' | 'flow_other';
export type BillingPaymentStatus = 'pending' | 'confirmed' | 'rejected';

export type BankTransferInfoDto = Readonly<{
  bank: string | null;
  accountType: string | null;
  accountNumber: string | null;
  holderName: string | null;
  holderTaxId: string | null;
  email: string | null;
}>;

/** Un pago nunca se borra: un reverso es otro registro (kind reversal + reversesPaymentId). */
export type BillingPaymentDto = Readonly<{
  id: number;
  invoiceId: number;
  kind: 'payment' | 'refund' | 'reversal';
  method: BillingPaymentMethod;
  amount: number;
  /** pending: informado por el dueño, espera revisión. */
  status: BillingPaymentStatus;
  paidAt: string | null;
  reference: string | null;
  receiptFileId: string | null;
  /** Temporal: no guardar. */
  receiptUrl: string | null;
  comment: string | null;
  reversesPaymentId: number | null;
  rejectionReason: string | null;
  createdAt: string;
}>;

/** Cobro de un período (period) o diferencia de un upgrade (proration). */
export type InvoiceWithPaymentsDto = Readonly<{
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
  status: InvoiceStatus;
  paidAt: string | null;
  createdAt: string;
  plan: PlanRef;
  interval: PlanInterval;
  /** Pagos confirmados menos reversos. */
  paidAmount: number;
  /** Transferencias informadas en revisión. */
  pendingAmount: number;
  payments: BillingPaymentDto[];
}>;

export type NextChargeDto = Readonly<{
  date: string;
  plan: PlanRef;
  interval: PlanInterval;
  subtotal: number;
  discountAmount: number;
  total: number;
}>;

/** GET /subscription (solo el dueño o SUPERADMIN; otros: 403 BILLING_OWNER_REQUIRED). */
export type OwnerSubscriptionDto = Readonly<{
  id: number;
  plan: PlanRef;
  price: Readonly<{ id: number; interval: PlanInterval; amount: number }> | null;
  status: SubscriptionStatus;
  billingMethod: 'none' | 'flow' | 'manual';
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlan: PlanRef | null;
  discount: Readonly<{ id: number; code: string | null; name: string; type: 'percent' | 'amount'; value: number; duration: 'once' | 'repeating' | 'forever' }> | null;
  discountPeriodsLeft: number | null;
  card: Readonly<{ brand: string | null; last4: string | null; registeredAt: string | null }> | null;
  billingEmail: string | null;
  billingTaxId: string | null;
  createdAt: string;
  updatedAt: string;
  /** null en prueba, plan free, cancelada o sin precio; con bajada programada muestra el plan nuevo. */
  nextCharge: NextChargeDto | null;
  /** Cobros pending u overdue. */
  openInvoices: InvoiceWithPaymentsDto[];
  bankTransferInfo: BankTransferInfoDto;
}>;

/** GET /plans: públicos y, si tiene, el plan a medida del negocio. Pagado con prices [] = "Próximamente". */
export type OwnerPlanDto = Readonly<{
  id: number;
  code: string;
  name: string;
  description: string | null;
  isFree: boolean;
  isHighlighted: boolean;
  isPublic: boolean;
  isCurrent: boolean;
  prices: ReadonlyArray<{ id: number; interval: PlanInterval; amount: number; currency: string; isCurrent: boolean }>;
  features: ReadonlyArray<{ code: string; name: string }>;
  limits: Readonly<Record<PlanLimitCode, number | null>>;
}>;

/**
 * purchase: cobro nuevo, el plan empieza al confirmar el pago (7 días para pagar).
 * renewal: cobro del próximo período. upgrade: se aplica al tiro + cobro de prorrateo (3 días).
 * scheduled: bajada o cambio de intervalo al fin del período (sin cobro ahora).
 */
export type CheckoutAction = 'purchase' | 'renewal' | 'upgrade' | 'scheduled';

/** Por ahora solo method 'manual' (flow responde 400 hasta la fase 5). */
export type CheckoutRequestDto = Readonly<{ priceId: number; couponCode?: string; method: 'manual' | 'flow' }>;

export type CheckoutResultDto = Readonly<{
  action: CheckoutAction;
  invoice: InvoiceWithPaymentsDto | null;
  scheduledChange: Readonly<{ plan: PlanRef; priceId: number; at: string }> | null;
  subscription: OwnerSubscriptionDto;
  bankTransferInfo: BankTransferInfoDto;
}>;

/** El dueño informa su transferencia (queda pending hasta que Redom la confirma). */
export type ManualPaymentRequestDto = Readonly<{
  amount: number;
  reference: string;
  paidAt: string;
  receiptFileId?: string | null;
  comment?: string | null;
}>;
