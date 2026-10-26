import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from 'src/app/modules/auth/pages/data-access';

/** Sesión restringida (documentos legales por aceptar): ninguna pantalla de la app, solo "Antes de seguir". */
export const legalRestrictedGuard: CanActivateFn = () =>
  inject(AuthService).isRestricted() ? inject(Router).parseUrl('/legal/accept') : true;

/** "Antes de seguir": requiere sesión. */
export const legalAcceptGuard: CanActivateFn = () =>
  inject(AuthService).isLogin() ? true : inject(Router).parseUrl('/auth/sign-in');
