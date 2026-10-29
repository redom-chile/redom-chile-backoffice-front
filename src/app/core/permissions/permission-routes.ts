import { AUTH_PERMISSIONS as AUTH } from './auth.permissions';
import { BILLING_PERMISSIONS as BILLING } from './billing.permissions';
import { RESTAURANT_PERMISSIONS as REST } from './restaurant.permissions';
import type { PermissionCode } from './index';

/**
 * Permiso que pide cada pantalla: el `see-module` de su módulo (mapa de módulos a pantallas del backend).
 * Gana el prefijo más largo. Sin entrada, el guard deja entrar a cualquier usuario con sesión, pero el menú
 * solo muestra las de PUBLIC_ROUTES (el resto son pantallas de plantilla).
 * Lo usan el menú (ocultar) y permissionGuard (no entrar). El plan se revisa aparte (plan-routes.ts).
 */
const PERMISSION_ROUTES: ReadonlyArray<readonly [string, PermissionCode]> = [
  ['/dashboard', REST.DASHBOARD.SEE_MODULE],
  ['/pos', REST.ORDERS.SEE_MODULE],
  ['/orders', REST.ORDERS.SEE_MODULE],
  ['/payments', REST.PAYMENTS.SEE_MODULE],
  ['/cash', REST.CASH.SEE_MODULE],
  ['/tables', REST.TABLES.SEE_MODULE],
  ['/sectors', REST.SECTORS.SEE_MODULE],
  ['/bookings', REST.BOOKINGS.SEE_MODULE],
  ['/kitchen', REST.KITCHEN.SEE_MODULE],
  ['/customers', REST.CUSTOMERS.SEE_MODULE],
  ['/products', REST.PRODUCTS.SEE_MODULE],
  ['/products/categories', REST.CATEGORIES.SEE_MODULE],
  ['/products/modifiers', REST.MODIFIERS.SEE_MODULE],
  ['/products/improve', REST.PRODUCTS.SEE_MODULE],
  ['/finance/expenses', REST.EXPENSES.SEE_MODULE],
  ['/finance/recurring', REST.EXPENSES.SEE_MODULE],
  ['/finance/categories', REST.EXPENSES.SEE_MODULE],
  ['/finance/payables', REST.PAYABLES.SEE_MODULE],
  ['/finance/purchases', REST.PAYABLES.SEE_MODULE],
  ['/finance/tips', REST.TIPS.SEE_MODULE],
  ['/finance/settlements', REST.FINANCE_REPORTS.SEE_MODULE],
  ['/inventory', REST.INVENTORY.SEE_MODULE],
  ['/inventory/purchase-orders', REST.PURCHASE_ORDERS.SEE_MODULE],
  ['/inventory/recipes', REST.RECIPES.SEE_MODULE],
  ['/inventory/food-cost', REST.RECIPES.SEE_MODULE],
  ['/inventory/units', REST.UNITS.SEE_MODULE],
  ['/inventory/ingredients', REST.PRODUCTS.SEE_MODULE],
  ['/business', REST.BUSINESS.SEE_MODULE],
  ['/business/location', REST.LOCATIONS.SEE_MODULE],
  ['/customer-orders', REST.CUSTOMER_ORDERS.SEE_MODULE],
  // El widget es gratis: lo ve quien ve la carta; Llaves y Webhooks revisan public-api:* dentro de la pantalla.
  ['/settings/public-api', REST.PUBLIC_MENU.SEE_MODULE],
  ['/settings/menu-translations', REST.PUBLIC_MENU.SEE_MODULE],
  ['/loyalty', REST.LOYALTY.SEE_MODULE],
  ['/settings/public-menu/sold-out', REST.PUBLIC_MENU.MANAGE_AVAILABILITY],
  ['/settings/public-menu/design', REST.PUBLIC_MENU.SEE_MODULE],
  ['/settings/public-menu/dynamic', REST.PUBLIC_MENU.SEE_MODULE],
  ['/settings/public-menu/marketing', REST.PUBLIC_MENU.SEE_MODULE],
  ['/settings/public-menu', REST.PUBLIC_MENU.SEE_MODULE],
  ['/settings/schedules', REST.SCHEDULES.SEE_MODULE],
  ['/settings/stations', REST.STATIONS.SEE_MODULE],
  ['/settings/printers', REST.PRINTERS.SEE_MODULE],
  ['/settings/print-station', REST.PRINT_JOBS.SEE_MODULE],
  ['/settings/payment-methods', REST.PAYMENT_METHODS.SEE_MODULE],
  ['/settings/registers', REST.CASH.SEE_MODULE],
  ['/settings/terminal', REST.ORDERS.SEE_MODULE],
  ['/billing', BILLING.SUBSCRIPTION.SEE_MODULE],
  ['/roles-and-permissions/modules', AUTH.MODULES.SEE_MODULE],
  ['/roles-and-permissions/permissions', AUTH.PERMISSIONS.SEE_MODULE],
  ['/roles-and-permissions/roles', AUTH.ROLES.SEE_MODULE],
  ['/roles-and-permissions/roles-permissions', AUTH.ROLES_PERMISSIONS.SEE_MODULE],
  ['/roles-and-permissions/roles-user', AUTH.USER_ROLES.SEE_MODULE],
  ['/roles-and-permissions/users', AUTH.USERS.SEE_MODULE],
  ['/help/admin', REST.HELP_CENTER.SEE_MODULE],
  ['/platform/legal', AUTH.LEGAL.SEE_MODULE],
  ['/platform/summary', BILLING.PLATFORM_SUMMARY.SEE_MODULE],
  ['/platform/businesses', BILLING.PLATFORM_BUSINESSES.SEE_MODULE],
  ['/platform/plans', BILLING.PLANS.SEE_MODULE],
  ['/platform/discounts', BILLING.DISCOUNTS.SEE_MODULE],
  ['/platform/support-access', BILLING.PLATFORM_SUPPORT_ACCESS.SEE_MODULE],
  ['/platform/payments-review', BILLING.PLATFORM_PAYMENTS.SEE_MODULE],
  ['/platform/invoices', BILLING.PLATFORM_PAYMENTS.SEE_MODULE],
  ['/platform/settings', BILLING.PLATFORM_SETTINGS.SEE_MODULE],
];

/** Pantallas sin permiso que el menú muestra a todos. */
const PUBLIC_ROUTES: readonly string[] = ['/help', '/profile'];

const BY_LENGTH = [...PERMISSION_ROUTES].sort((a, b) => b[0].length - a[0].length);

/** Permiso que exige una URL (null = no pide permiso). */
export function permissionForUrl(url: string | null | undefined): PermissionCode | null {
  if (!url) return null;
  const path = url.split(/[?#]/)[0];
  const match = BY_LENGTH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}

/** Pantalla sin permiso propio que cualquier usuario con sesión ve en el menú. */
export function isPublicUrl(url: string | null | undefined): boolean {
  const path = (url ?? '').split(/[?#]/)[0];
  return PUBLIC_ROUTES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
