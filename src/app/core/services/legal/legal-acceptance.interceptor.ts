import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { isLegalBlock, legalDocumentsOf } from './legal-errors';
import { LegalPromptService } from './legal-prompt.service';
import { LegalSessionStore } from './legal-session.store';

// Login y registro manejan su propio 428 (Google); /legal/* y lo público (carta) nunca se reintentan aquí.
const EXEMPT = [`${ApiPathEnum.AUTH}/login/`, `${ApiPathEnum.AUTH}/legal/`, `${ApiPathEnum.RESTAURANT}/public/`];

/**
 * 428 LEGAL_ACCEPTANCE_REQUIRED de cualquier API del backoffice: abre el modal bloqueante y, al aceptar, reintenta la
 * petición. Con la sesión restringida no hay modal: todo lleva a /legal/accept.
 * Va antes de AuthInterceptor para que el reintento lleve el token.
 */
export const legalAcceptanceInterceptor: HttpInterceptorFn = (req, next) => {
  if (EXEMPT.some((path) => req.url.startsWith(path))) return next(req);
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!isLegalBlock(error)) return throwError(() => error);
      if (injector.get(LegalSessionStore).$restricted()) {
        injector.get(Router).navigateByUrl('/legal/accept');
        return throwError(() => error);
      }
      return injector
        .get(LegalPromptService)
        .require(legalDocumentsOf(error) ?? [])
        .pipe(switchMap((accepted) => (accepted ? next(req) : throwError(() => error))));
    }),
  );
};
