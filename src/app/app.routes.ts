import { Routes } from '@angular/router';
import { businessGuard, legalRestrictedGuard, permissionGuard, terminalModeGuard } from './core';
import { planFeatureGuard } from './core/services/entitlements';

export const routes: Routes = [
  {
    // Terminal de salón: pantalla completa, fuera del layout del backoffice.
    path: 'terminal',
    canActivate: [legalRestrictedGuard],
    loadChildren: () => import('./modules/terminal/terminal.routes'),
  },
  {
    // Primer ingreso de un dueño sin negocio: crear el negocio.
    path: 'onboarding',
    loadChildren: () => import('./modules/onboarding/onboarding.routes'),
  },
  {
    // Documentos legales: lectura pública (/legal/:code, enlace de los correos) y "Antes de seguir" (/legal/accept).
    path: 'legal',
    loadChildren: () => import('./modules/legal/legal.routes'),
  },
  {
    path: '',
    // Permiso del rol y luego plan del negocio: sin permiso no se ofrece mejorar el plan.
    // Con la sesión restringida por documentos legales no se entra a nada (ni se carga whoami).
    canActivateChild: [legalRestrictedGuard, terminalModeGuard, businessGuard, permissionGuard, planFeatureGuard],
    loadChildren: () => import('./modules/layout/layout.routes'),
  },
  {
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.routes'),
  },
  {
    path: 'errors',
    loadChildren: () => import('./modules/error/error.routes'),
  },
  { path: '**', redirectTo: 'errors/404' },
];
