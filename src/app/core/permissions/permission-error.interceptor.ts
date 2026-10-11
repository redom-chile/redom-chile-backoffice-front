import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from 'src/ui';
import { readApiError } from '../utils/api-error';
import { WhoamiService } from '../services/whoami/whoami.service';

export const PERMISSION_DENIED = 'PERMISSION_DENIED';

/**
 * 403 PERMISSION_DENIED desde cualquier API: los roles del usuario pudieron cambiar, así que se refresca whoami
 * (el menú y los botones se recalculan) y se avisa. El error sigue su curso para que la pantalla deje de esperar.
 * El aviso sale después del manejo de la pantalla para que no lo tape su mensaje genérico.
 * Los servicios se piden recién ante el error (whoami hace su primera petición al crearse: NG0200).
 */
export const permissionErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && readApiError(error).code === PERMISSION_DENIED) {
        injector.get(WhoamiService).refetch();
        const toast = injector.get(ToastService);
        setTimeout(() => toast.show('No tienes permiso para esta acción.', 'error'));
      }
      return throwError(() => error);
    }),
  );
};

/** Para que las pantallas no muestren además su mensaje genérico ante un 403 de permiso. */
export function isPermissionError(error: unknown): boolean {
  return readApiError(error).code === PERMISSION_DENIED;
}
