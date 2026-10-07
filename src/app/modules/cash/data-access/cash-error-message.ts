import { readApiError } from 'src/app/core/utils/api-error';

const BY_CODE: Record<string, string> = {
  CASH_MANAGEMENT_DISABLED: 'La caja no está activada. Actívala en Mi negocio → Punto de venta.',
  CASH_SESSION_REQUIRED: 'La caja está cerrada. Ábrela para continuar.',
  CASH_SESSION_ALREADY_OPEN: 'Esa caja ya tiene un turno abierto.',
  CASH_SESSION_CLOSED: 'El turno ya se cerró.',
  CASH_REGISTER_AMBIGUOUS: 'Hay varias cajas abiertas en este local: elige con cuál cobrar.',
};

const BY_MESSAGE: ReadonlyArray<[RegExp, string]> = [
  [/Cash register not found/i, 'No encontramos esa caja.'],
  [/Cash session not found/i, 'No encontramos ese turno.'],
  [/cash register is inactive/i, 'La caja está desactivada. Actívala en Configuración → Cajas.'],
  [/belongs to another location/i, 'La caja elegida es de otro local que el pedido.'],
  [/counted twice/i, 'Un medio de pago está contado dos veces.'],
  [/cash must be counted/i, 'Cuenta el efectivo para cerrar la caja.'],
  [/does not match its bills and coins/i, 'El total no coincide con la suma de billetes y monedas.'],
  [/Location not found/i, 'No encontramos ese local.'],
];

/** Mensaje en español para errores de caja: primero por código, luego por el texto del backend. */
export function getCashErrorMessage(error: unknown, fallback = 'No se pudo completar la operación de caja.'): string {
  const api = readApiError(error);
  if (api.status === 0) return 'No hay conexión con el servidor.';
  if (api.code && BY_CODE[api.code]) return BY_CODE[api.code];
  const found = BY_MESSAGE.find(([pattern]) => pattern.test(api.message));
  return found ? found[1] : fallback;
}
