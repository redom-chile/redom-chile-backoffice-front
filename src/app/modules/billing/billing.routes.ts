import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'subscription', pathMatch: 'full' },
      // Mi suscripción (solo el dueño; otros usuarios: 403 BILLING_OWNER_REQUIRED).
      { path: 'subscription', loadComponent: () => import('./pages/subscription').then((m) => m.SubscriptionComponent) },
      // Comparación de planes (el checkout llega en la próxima fase).
      { path: 'plans', loadComponent: () => import('./pages/plans').then((m) => m.PlansComponent) },
    ],
  },
];

export default routes;
