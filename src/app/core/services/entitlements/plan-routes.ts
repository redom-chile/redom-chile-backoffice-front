import { PlanFeatureCode } from './dtos';

/** Una lista exige todas las funciones; `{ anyOf }` basta con una (pantallas con secciones de distinto plan). */
type PlanRouteRule = PlanFeatureCode[] | Readonly<{ anyOf: PlanFeatureCode[] }>;

/** Lo que pide una URL: `mode: 'all'` todas, `'any'` al menos una. */
export type PlanRequirement = Readonly<{ mode: 'all' | 'any'; features: readonly PlanFeatureCode[] }>;

/**
 * Función del plan que pide cada pantalla (mismo mapa que el backend; si falta, responde 403).
 * Gana el prefijo más largo. Sin entrada = todos los planes (dashboard, negocio, productos, clientes, ayuda…).
 * Lo usan el menú (candados) y planFeatureGuard (modal en vez de la pantalla).
 */
const PLAN_ROUTE_FEATURES: ReadonlyArray<readonly [string, PlanRouteRule]> = [
  ['/pos', ['pos']],
  ['/orders', ['pos']],
  ['/customer-orders', ['table_ordering']],
  ['/payments', ['pos']],
  ['/tables', ['pos']],
  ['/sectors', ['pos']],
  ['/settings/terminal', ['pos']],
  ['/kitchen', ['kitchen_display']],
  ['/settings/stations', ['kitchen_display']],
  ['/settings/menu-translations', ['menu_translations']],
  ['/settings/public-menu/marketing', { anyOf: ['menu_marketing', 'menu_branding'] }],
  ['/settings/public-menu', ['qr_menu']],
  ['/loyalty', ['loyalty']],
  ['/settings/printers', ['printing']],
  ['/settings/print-station', ['printing']],
  ['/bookings', ['bookings']],
  ['/cash', ['cash']],
  ['/settings/registers', ['cash']],
  ['/finance/settlements', ['reports']],
  ['/finance/tips', ['tips']],
  ['/finance', ['finance']],
  ['/inventory/transfers', ['inventory', 'multi_location']],
  ['/inventory/productions', ['inventory', 'recipes']],
  ['/inventory/recipes', ['recipes']],
  ['/inventory/food-cost', ['recipes']],
  ['/inventory/units', []],
  ['/inventory/ingredients', []],
  ['/inventory', ['inventory']],
];

const BY_LENGTH = [...PLAN_ROUTE_FEATURES].sort((a, b) => b[0].length - a[0].length);

const NONE: PlanRequirement = { mode: 'all', features: [] };

export function planRequirementForUrl(url: string | null | undefined): PlanRequirement {
  if (!url) return NONE;
  const path = url.split(/[?#]/)[0];
  const match = BY_LENGTH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (!match) return NONE;
  const rule = match[1];
  return Array.isArray(rule) ? { mode: 'all', features: rule } : { mode: 'any', features: (rule as { anyOf: PlanFeatureCode[] }).anyOf };
}

/** Lo que falta para entrar ([] si se cumple). Con "alguna", se ofrece la primera de la lista. */
export function missingPlanFeatures(requirement: PlanRequirement, has: (code: PlanFeatureCode) => boolean): PlanFeatureCode[] {
  const { mode, features } = requirement;
  if (mode === 'all') return features.filter((code) => !has(code));
  return !features.length || features.some((code) => has(code)) ? [] : [features[0]];
}
