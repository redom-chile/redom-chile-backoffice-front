import { PlanFeatureCode } from './dtos';

/**
 * Función del plan que pide cada pantalla (mismo mapa que el backend; si falta, responde 403).
 * Gana el prefijo más largo. Sin entrada = todos los planes (dashboard, negocio, productos, clientes, ayuda…).
 * Lo usan el menú (candados) y planFeatureGuard (modal en vez de la pantalla).
 */
const PLAN_ROUTE_FEATURES: ReadonlyArray<readonly [string, PlanFeatureCode[]]> = [
  ['/pos', ['pos']],
  ['/orders', ['pos']],
  ['/payments', ['pos']],
  ['/tables', ['pos']],
  ['/sectors', ['pos']],
  ['/settings/terminal', ['pos']],
  ['/kitchen', ['kitchen_display']],
  ['/settings/stations', ['kitchen_display']],
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

/** Funciones que exige una URL (todas deben estar en el plan). */
export function planFeaturesForUrl(url: string | null | undefined): PlanFeatureCode[] {
  if (!url) return [];
  const path = url.split(/[?#]/)[0];
  const match = BY_LENGTH.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : [];
}
