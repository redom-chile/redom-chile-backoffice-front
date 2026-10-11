import { Routes } from '@angular/router';
import { businessGuard, permissionGuard, terminalModeGuard } from './core';
import { planFeatureGuard } from './core/services/entitlements';

export const routes: Routes = [
  {
    // Terminal de salón: pantalla completa, fuera del layout del backoffice.
    path: 'terminal',
    loadChildren: () => import('./modules/terminal/terminal.routes'),
  },
  {
    // Primer ingreso de un dueño sin negocio: crear el negocio.
    path: 'onboarding',
    loadChildren: () => import('./modules/onboarding/onboarding.routes'),
  },
  {
    path: '',
    // Permiso del rol y luego plan del negocio: sin permiso no se ofrece mejorar el plan.
    canActivateChild: [terminalModeGuard, businessGuard, permissionGuard, planFeatureGuard],
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
