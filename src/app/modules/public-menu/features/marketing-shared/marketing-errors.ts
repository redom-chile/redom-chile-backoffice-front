import { HttpErrorResponse } from '@angular/common/http';
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

/** Al eliminar: el registro ya no existía (se trata como eliminado). */
export function isAlreadyDeleted(error: unknown): boolean {
  return readApiError(error).status === 404;
}

// Mensajes del backend sin código de negocio (vienen en inglés) que sí se pueden explicar.
const KNOWN_MESSAGES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^promotion not found/i, 'La promoción ya no existe. Recarga la página.'],
  [/^banner not found/i, 'El banner ya no existe. Recarga la página.'],
  [/^product not found/i, 'El producto elegido ya no existe. Revisa el formulario.'],
  [/^category not found/i, 'La categoría elegida ya no existe. Revisa el formulario.'],
  [/^location not found/i, 'El local elegido ya no existe. Revisa el formulario.'],
  [/^variation not found/i, 'La variedad elegida ya no existe. Revisa el formulario.'],
  [/^endsAt must be after startsAt/i, 'La fecha de término debe ser posterior a la de inicio.'],
  [/^startTime and endTime go together/i, 'Indica la hora de inicio y la de término.'],
  [/must be HH:MM/i, 'Usa horas en formato HH:MM.'],
  [/must be a color/i, 'Usa colores en formato #RRGGBB.'],
  [/^linkUrl must be an http/i, 'El enlace debe empezar con http:// o https://.'],
  [/percent can not be greater than 100/i, 'El porcentaje no puede ser mayor a 100.'],
  [/^value must be greater than 0/i, 'El valor debe ser mayor a 0.'],
  [/^title is required/i, 'Escribe un título.'],
  [/^name is required/i, 'Escribe un nombre.'],
];

// Códigos que el backend arma desde errores de base de datos.
const GENERIC_CODES: Readonly<Record<string, string>> = {
  RECORD_IN_USE: 'No se puede eliminar porque se está usando en otro lugar.',
  RELATED_RECORD_NOT_FOUND: 'El producto, la categoría o el local elegido ya no existe. Revisa el formulario.',
  DUPLICATE_RECORD: 'Ya existe un registro con esos datos.',
};

// Texto técnico en inglés (class-validator o validaciones del servicio): no se muestra tal cual.
const TECHNICAL = /\b(must|should|is required|are required|not found|cannot|can not|needs?|invalid|is not a valid|go together|does not exist|already exists|out of range|property|bad request|internal server|records?)\b/i;

/** Mensaje del cuerpo del error (si es un arreglo de validaciones, unidos). */
function backendMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return '';
  const raw = (error.error as { message?: unknown } | null)?.message;
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string' && !!item.trim()).join('. ');
  return '';
}

/** Mensaje para un error al guardar; null si es de plan (ya lo muestra el modal global). */
export function marketingSaveError(error: unknown, fallback: string): string | null {
  if (isPlanError(error)) return null;
  const api = readApiError(error);
  // Códigos de negocio conocidos.
  const byCode = getPublicMenuErrorMessage(error, '') || GENERIC_CODES[api.code ?? ''];
  if (byCode) return byCode;
  if (api.status === 403) return 'No tienes permiso para hacer este cambio.';

  const message = backendMessage(error);
  const known = KNOWN_MESSAGES.find(([pattern]) => pattern.test(message));
  if (known) return known[1];
  if (api.status === 404) return 'Lo que intentas cambiar ya no existe. Recarga la página.';
  if (api.status >= 400 && api.status < 500 && message) {
    if (!TECHNICAL.test(message)) return message;
    return 'Revisa los datos del formulario: hay un valor que no es válido.';
  }
  return fallback;
}
