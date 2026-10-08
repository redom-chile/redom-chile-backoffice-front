import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { readApiError } from '../../utils/api-error';
import { PlanErrorDetails } from './dtos';
import { EntitlementsService } from './entitlements.service';
import { PlanUpsellService } from './plan-upsell.service';

const PLAN_CODES = new Set(['PLAN_FEATURE_NOT_INCLUDED', 'PLAN_LIMIT_REACHED', 'PLAN_RESOURCE_LOCKED']);

/**
 * Errores de plan desde cualquier API: refresca los entitlements (el plan pudo cambiar) y muestra el modal
 * para mejorar el plan. El error sigue su curso para que la pantalla deje de esperar.
 * Los servicios se piden recién ante un error de plan: EntitlementsService depende de WhoamiService, que hace su
 * primera petición al crearse, y pedirlos en cada petición formaría una dependencia circular (NG0200).
 */
export const planErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const api = readApiError(error);
        if (api.code && PLAN_CODES.has(api.code)) {
          const details = api.details as PlanErrorDetails;
          injector.get(EntitlementsService).refresh();
          injector.get(PlanUpsellService).open({
            features: details.feature ? [details.feature] : undefined,
            limit: details.limit,
            max: details.max,
            used: details.used,
            resource: details.resource,
            requiredPlans: details.requiredPlans,
          });
        }
      }
      return throwError(() => error);
    }),
  );
};

/** Para que las pantallas no muestren además su toast genérico ante un error de plan. */
export function isPlanError(error: unknown): boolean {
  const code = readApiError(error).code;
  return !!code && PLAN_CODES.has(code);
}
