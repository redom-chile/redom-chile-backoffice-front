/**
 * Permisos del servicio billing. Copia de `BillingPermission.BILLING` (backend: libs/billing/enums/src/lib/permission.enum.ts): mantener igual.
 * Los datos de cobro de un negocio exigen además ser su dueño: el permiso se suma a esa regla, no la reemplaza.
 */
export const BILLING_PERMISSIONS = {
  SUBSCRIPTION: {
    SEE_MODULE: 'subscription:see-module',
    GET_SUBSCRIPTION: 'subscription:get-subscription',
    CHECKOUT: 'subscription:checkout',
    MANAGE_CARD: 'subscription:manage-card',
    CANCEL_SUBSCRIPTION: 'subscription:cancel-subscription',
    REPORT_PAYMENT: 'subscription:report-payment',
  },
  PLANS: {
    SEE_MODULE: 'plans:see-module',
    GET_ALL_PLANS: 'plans:get-all-plans',
    CREATE_PLAN: 'plans:create-plan',
    UPDATE_PLAN: 'plans:update-plan',
    MANAGE_PRICES: 'plans:manage-prices',
  },
  DISCOUNTS: {
    SEE_MODULE: 'discounts:see-module',
    GET_ALL_DISCOUNTS: 'discounts:get-all-discounts',
    CREATE_DISCOUNT: 'discounts:create-discount',
    UPDATE_DISCOUNT: 'discounts:update-discount',
  },
  PLATFORM_BUSINESSES: {
    SEE_MODULE: 'platform-businesses:see-module',
    GET_ALL_BUSINESSES: 'platform-businesses:get-all-businesses',
    GET_BUSINESS: 'platform-businesses:get-business',
    UPDATE_SUBSCRIPTION: 'platform-businesses:update-subscription',
    MANAGE_DISCOUNTS: 'platform-businesses:manage-discounts',
    MANAGE_OVERRIDES: 'platform-businesses:manage-overrides',
  },
  PLATFORM_PAYMENTS: {
    SEE_MODULE: 'platform-payments:see-module',
    GET_ALL_INVOICES: 'platform-payments:get-all-invoices',
    REGISTER_PAYMENT: 'platform-payments:register-payment',
    REVIEW_PAYMENT: 'platform-payments:review-payment',
    REVERSE_PAYMENT: 'platform-payments:reverse-payment',
    EXPORT_PAYMENTS: 'platform-payments:export-payments',
  },
  PLATFORM_SUPPORT_ACCESS: {
    SEE_MODULE: 'platform-support-access:see-module',
    GET_ALL_SUPPORT_ACCESS: 'platform-support-access:get-all-support-access',
    REVOKE_SUPPORT_ACCESS: 'platform-support-access:revoke-support-access',
  },
  PLATFORM_SETTINGS: {
    SEE_MODULE: 'platform-settings:see-module',
    GET_SETTINGS: 'platform-settings:get-settings',
    UPDATE_SETTINGS: 'platform-settings:update-settings',
    RUN_JOBS: 'platform-settings:run-jobs',
  },
  PLATFORM_SUMMARY: {
    SEE_MODULE: 'platform-summary:see-module',
    GET_SUMMARY: 'platform-summary:get-summary',
  },
} as const;
