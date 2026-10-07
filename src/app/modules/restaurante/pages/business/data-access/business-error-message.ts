import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje en español para errores al guardar datos del negocio. */
export function getBusinessErrorMessage(error: unknown, fallback = 'No se pudo guardar. Inténtalo de nuevo.'): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 0) return 'No hay conexión con el servidor.';
  if (error.status === 403) return 'No tienes permiso para esta acción.';
  if (error.status === 400) return 'Revisa los datos ingresados.';
  return fallback;
}
