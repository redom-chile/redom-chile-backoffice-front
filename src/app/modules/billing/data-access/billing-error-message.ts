import { readApiError } from 'src/app/core/utils/api-error';
import { PLAN_LIMIT_LABELS, PlanLimitCode } from 'src/app/core/services/entitlements';

/** Errores de la suscripción del dueño y del checkout. */
export function getBillingErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const api = readApiError(error);
  const details = api.details;
  if (api.status === 0) return 'No hay conexión con el servidor.';
  switch (api.code) {
    case 'BILLING_OWNER_REQUIRED':
      return 'Solo el dueño del negocio puede ver y cambiar la suscripción.';
    case 'PLAN_DOWNGRADE_OVER_LIMIT': {
      const limit = details['limit'] as PlanLimitCode | undefined;
      const label = limit ? PLAN_LIMIT_LABELS[limit] : null;
      const used = Number(details['used']);
      const max = Number(details['max']);
      if (label && Number.isFinite(used) && Number.isFinite(max))
        return `Tienes ${used} ${used === 1 ? label.one : label.many} y el plan permite ${max}. Desactiva los que sobran para cambiar.`;
      return 'Usas más de lo que permite ese plan. Desactiva lo que sobra para cambiar.';
    }
    case 'PAYMENT_PENDING_REVIEW':
      return 'Tienes una transferencia en revisión. Espera a que la confirmemos para hacer otro cambio.';
    case 'PLAN_PRICE_NOT_FOUND':
      return 'Ese precio ya no está disponible. Recarga los planes.';
    case 'DISCOUNT_INVALID':
      return 'El cupón no es válido o ya no tiene usos disponibles.';
    case 'DISCOUNT_EXPIRED':
      return 'El cupón está vencido.';
    case 'DISCOUNT_NOT_APPLICABLE':
      return 'El cupón no aplica a este plan.';
    case 'INVOICE_NOT_PAYABLE':
      return 'Este cobro ya no está pendiente.';
    case 'PAYMENT_PROVIDER_ERROR':
      return 'El pago con tarjeta todavía no está disponible. Usa transferencia.';
  }
  if (api.status === 404 && /file|receipt/i.test(api.message)) return 'El comprobante no se subió bien. Vuelve a adjuntarlo.';
  if (api.status === 400 && /amount/i.test(api.message)) return 'El monto supera lo que falta pagar (incluye las transferencias en revisión).';
  return fallback;
}
