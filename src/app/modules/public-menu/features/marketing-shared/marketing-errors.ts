import { isPlanError, PlanErrorDetails } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { getPublicMenuErrorMessage } from 'src/app/modules/public-menu/data-access';

/** Local para los selectores ("Todos los locales" = null). */
export type MarketingLocation = Readonly<{ id: number; name: string }>;

/** El error es 403 PLAN_FEATURE_NOT_INCLUDED. */
export function isFeatureNotIncluded(error: unknown): boolean {
  return readApiError(error).code === 'PLAN_FEATURE_NOT_INCLUDED';
}

/** Planes que incluyen la función, según el error del backend. */
export function requiredPlansOf(error: unknown): string[] {
  return (readApiError(error).details as PlanErrorDetails).requiredPlans ?? [];
}

/** Mensaje para un error al guardar; null si es de plan (ya lo muestra el modal global). */
export function marketingSaveError(error: unknown, fallback: string): string | null {
  if (isPlanError(error)) return null;
  const api = readApiError(error);
  if (api.status === 404) return 'El producto, la categoría o el local elegido ya no existe. Revisa el formulario.';
  if (api.status === 403) return 'No tienes permiso para hacer este cambio.';
  if (api.status === 400 && !api.code?.startsWith('SLUG')) return 'Revisa los datos del formulario: hay un valor que no es válido.';
  return getPublicMenuErrorMessage(error, fallback);
}
