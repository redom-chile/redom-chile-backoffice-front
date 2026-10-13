import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ToastService } from 'src/ui';
import { readApiError } from '../../utils/api-error';
import { SupportModeService } from './support-mode.service';

/**
 * En modo soporte agrega X-Support-Business-Id a las llamadas a restaurant (nunca a auth ni billing).
 * Si el acceso terminó (SUPPORT_ACCESS_NOT_GRANTED) sale del modo; fuera de la carta avisa.
 * Los servicios se piden por Injector para no formar dependencias circulares con HttpClient.
 */
export const supportAccessInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const support = injector.get(SupportModeService);
  const businessId = support.$businessId();
  if (!businessId || !req.url.startsWith(ApiPathEnum.RESTAURANT)) return next(req);

  return next(req.clone({ setHeaders: { 'X-Support-Business-Id': String(businessId) } })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const code = readApiError(error).code;
        if (code === 'SUPPORT_ACCESS_NOT_GRANTED') support.exit('El acceso de soporte terminó');
        else if (code === 'SUPPORT_ACCESS_OUT_OF_SCOPE') injector.get(ToastService).show('Esta acción no está incluida en el acceso de soporte', 'warning');
      }
      return throwError(() => error);
    }),
  );
};

/** Para que las pantallas no muestren además su toast genérico. */
export function isSupportAccessError(error: unknown): boolean {
  return !!readApiError(error).code?.startsWith('SUPPORT_ACCESS_');
}
