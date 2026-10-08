/** Contrato de planes (#47, fase 2). Backend: libs/billing/entitlements y libs/billing/database/src/enums. */

export const PLAN_FEATURES = [
  'pos',
  'kitchen_display',
  'qr_menu',
  'help_assistant',
  'cash',
  'bookings',
  'printing',
  'reports',
  'inventory',
  'recipes',
  'finance',
  'tips',
  'multi_location',
] as const;
export type PlanFeatureCode = (typeof PLAN_FEATURES)[number];

export type PlanLimitCode = 'max_locations' | 'max_users' | 'max_registers' | 'ai_questions_month';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled';

export type LockableResource = 'locations' | 'registers' | 'users';

/**
 * Lo que puede usar el negocio: plan efectivo + excepciones, límites (null = ilimitado), uso y estado.
 * Usar siempre `plan` y `features` para habilitar; `status` es solo para los banners.
 */
export type EntitlementsDto = Readonly<{
  businessId: number;
  plan: Readonly<{ code: string; name: string }>;
  /** null: sin suscripción (usa el plan Free). */
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: PlanFeatureCode[];
  limits: Readonly<Record<PlanLimitCode, number | null>>;
  usage: Readonly<Record<PlanLimitCode, number>>;
  /** Sobre el límite del plan: solo lectura. `users` trae códigos (uuid). */
  lockedResources: Readonly<{ locations: number[]; registers: number[]; users: string[] }>;
}>;

export type PlanPriceDto = Readonly<{ id: number; interval: 'month' | 'year'; amount: number; currency: string }>;

/** GET /plans/public. `prices` puede venir vacío mientras el superadmin no define los precios. */
export type PublicPlanDto = Readonly<{
  id: number;
  code: string;
  name: string;
  description: string | null;
  isFree: boolean;
  isHighlighted: boolean;
  prices: PlanPriceDto[];
  features: ReadonlyArray<{ code: PlanFeatureCode; name: string }>;
  limits: Readonly<Record<PlanLimitCode, number | null>>;
}>;

/** details de PLAN_FEATURE_NOT_INCLUDED / PLAN_LIMIT_REACHED / PLAN_RESOURCE_LOCKED. */
export type PlanErrorDetails = Readonly<{
  feature?: PlanFeatureCode;
  limit?: PlanLimitCode;
  max?: number;
  used?: number;
  resource?: LockableResource;
  id?: number | string;
  requiredPlans?: string[];
}>;
