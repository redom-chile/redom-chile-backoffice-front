import { isPlanError } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { formatLoyaltyBalance } from './loyalty-format';
import { LoyaltyMechanic } from './dtos';

/**
 * Errores de fidelización. null si es de plan (ya lo muestra el modal global).
 * `context` cambia el texto de un 404: en el POS el cliente aún no tiene saldo.
 */
export function getLoyaltyErrorMessage(
  error: unknown,
  fallback = 'No se pudo completar la operación.',
  context: Readonly<{ mechanic?: LoyaltyMechanic | null; pos?: boolean }> = {},
): string | null {
  if (isPlanError(error)) return null;
  const api = readApiError(error);
  if (api.status === 0) return 'No hay conexión con el servidor.';
  switch (api.code) {
    case 'LOYALTY_SALE_WITHOUT_CUSTOMER':
      return 'Asigna el cliente a la venta.';
    case 'LOYALTY_INSUFFICIENT_BALANCE': {
      const balance = Number(api.details['balance'] ?? 0);
      return `No le alcanza: tiene ${formatLoyaltyBalance(balance, context.mechanic ?? null)}.`;
    }
    case 'LOYALTY_REWARD_ALREADY_APPLIED':
      return 'Esta venta ya tiene una recompensa.';
    case 'LOYALTY_DISCOUNT_CONFLICT':
      return 'La venta ya tiene un descuento.';
    case 'LOYALTY_PROGRAM_INACTIVE':
      return 'El programa de fidelización no está activo.';
    case 'ORDER_NOT_OPEN':
      return 'La venta ya no está abierta.';
  }
  if (api.status === 404) return context.pos ? 'Este cliente aún no tiene saldo.' : 'No es cliente del negocio.';
  if (api.status === 403) return 'No tienes permiso para hacer este cambio.';
  if (api.status === 400) return 'Revisa los datos del formulario: hay un valor que no es válido.';
  return fallback;
}

export function isLoyaltyPlanBlocked(error: unknown): boolean {
  return readApiError(error).code === 'PLAN_FEATURE_NOT_INCLUDED';
}
