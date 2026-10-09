import { readApiError } from 'src/app/core/utils/api-error';

/** Mensajes por código; algunos usan details (subscriptions, settings, fields). */
export function getPlatformErrorMessage(error: unknown, fallback = 'No se pudo completar la operación.'): string {
  const api = readApiError(error);
  const details = api.details;
  if (api.status === 0) return 'No hay conexión con el servidor.';
  if (api.status === 403) return 'Solo el equipo de Redom (SUPERADMIN) puede usar la plataforma.';
  switch (api.code) {
    case 'PLAN_CODE_TAKEN':
      return 'Ya existe un plan con ese código.';
    case 'PLAN_HAS_SUBSCRIPTIONS': {
      const count = Number(details['subscriptions']);
      return `No se puede desactivar: el plan tiene ${Number.isFinite(count) ? count : 'varias'} suscripciones vigentes. Cámbialas de plan primero.`;
    }
    case 'PLAN_REQUIRED_BY_SETTINGS': {
      const settings = Array.isArray(details['settings']) ? (details['settings'] as string[]) : [];
      const which = settings.map((key) => (key.includes('trial') ? 'el plan de prueba' : 'el plan de respaldo')).join(' y ');
      return `No se puede desactivar: es ${which || 'un plan usado en los ajustes'} de la plataforma. Cámbialo en Ajustes primero.`;
    }
    case 'PLAN_NOT_FOUND':
      return 'El plan no existe.';
    case 'PLAN_PRICE_NOT_FOUND':
      return 'Ese precio no pertenece al plan elegido.';
    case 'DISCOUNT_CODE_TAKEN':
      return 'Ya existe un descuento con ese código.';
    case 'DISCOUNT_IN_USE':
      return 'El descuento ya se usó: no se pueden cambiar su tipo, valor ni duración. Desactívalo y crea otro.';
    case 'DISCOUNT_NOT_FOUND':
      return 'El descuento no existe.';
    case 'DISCOUNT_INVALID':
      return 'El descuento está inactivo o ya no tiene usos disponibles.';
    case 'DISCOUNT_EXPIRED':
      return 'El descuento está fuera de su vigencia.';
    case 'DISCOUNT_NOT_APPLICABLE':
      return 'El descuento no aplica a este negocio, plan o intervalo.';
    case 'PLAN_OVERRIDE_NOT_FOUND':
      return 'La excepción no existe.';
    case 'PAYMENT_ALREADY_CONFIRMED':
      return 'Ese pago ya fue revisado.';
    case 'INVOICE_NOT_PAYABLE':
      return 'El cobro ya está pagado o anulado.';
    case 'PAYMENT_NOT_REVERSIBLE':
      return 'Solo se puede reversar un pago confirmado que no tenga reverso.';
    case 'SUBSCRIPTION_NOT_FOUND':
      return 'El negocio no tiene suscripción.';
  }
  if (api.status === 404) return 'No encontramos lo que buscabas.';
  if (api.status === 400 && api.message) return `Revisa los datos: ${api.message}`;
  return fallback;
}
