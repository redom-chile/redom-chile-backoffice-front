import { Routes } from '@angular/router';
import { authGuard, roleGuard } from 'src/app/core';
import { unsavedChangesGuard } from 'src/app/modules/inventory/shared/data-access';

// Solo el equipo de Redom (SUPERADMIN); funciona aunque no tenga negocio (ver businessGuard).
const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard, roleGuard],
    data: { roles: ['SUPERADMIN'] },
    children: [
      { path: '', redirectTo: 'summary', pathMatch: 'full' },
      { path: 'summary', loadComponent: () => import('./pages/platform-summary').then((m) => m.PlatformSummaryComponent) },
      // Query params opcionales: search, status, planId, overdue, trialEndingInDays, page.
      { path: 'businesses', pathMatch: 'full', loadComponent: () => import('./pages/platform-businesses').then((m) => m.PlatformBusinessesComponent) },
      { path: 'businesses/:id', loadComponent: () => import('./pages/platform-business-detail').then((m) => m.PlatformBusinessDetailComponent) },
      { path: 'plans', pathMatch: 'full', loadComponent: () => import('./pages/platform-plans').then((m) => m.PlatformPlansComponent) },
      // Query param opcional: tab (data, features, limits, prices).
      { path: 'plans/:id', loadComponent: () => import('./pages/platform-plan-detail').then((m) => m.PlatformPlanDetailComponent) },
      // Query params opcionales: search, isActive, page.
      { path: 'discounts', loadComponent: () => import('./pages/platform-discounts').then((m) => m.PlatformDiscountsComponent) },
      { path: 'settings', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./pages/platform-settings').then((m) => m.PlatformSettingsComponent) },
    ],
  },
];

export default routes;
