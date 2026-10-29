import { HttpErrorResponse } from '@angular/common/http';
import { readApiError } from 'src/app/core/utils/api-error';
import { OWNER_ONLY_SETTING_LABELS } from './business-owner';

/** Mensaje en español para errores al guardar datos del negocio. */
export function getBusinessErrorMessage(error: unknown, fallback = 'No se pudo guardar. Inténtalo de nuevo.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'No hay conexión con el servidor.';
  const { code, details } = readApiError(error);
  if (code === 'OWNER_ONLY_SETTING') {
    const fields = Array.isArray(details['fields']) ? (details['fields'] as unknown[]) : [];
    const labels = [...new Set(fields.map((field) => OWNER_ONLY_SETTING_LABELS[String(field)] ?? String(field)))];
    return labels.length ? `Solo el dueño puede cambiar: ${labels.join(', ')}.` : 'Solo el dueño puede cambiar estos datos.';
  }
  if (error.status === 403) return 'No tienes permiso para esta acción.';
  if (error.status === 400) return 'Revisa los datos ingresados.';
  return fallback;
}
