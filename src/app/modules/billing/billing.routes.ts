import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // Mi suscripción (solo el dueño; otros usuarios: 403 BILLING_OWNER_REQUIRED).
      // En /billing vuelve Flow con el resultado: card, payment, invoice, trial, reason (BILLING_FRONT_URL del backend).
      { path: '', pathMatch: 'full', loadComponent: () => import('./pages/subscription').then((m) => m.SubscriptionComponent) },
      { path: 'subscription', loadComponent: () => import('./pages/subscription').then((m) => m.SubscriptionComponent) },
      // Comparación y elección de planes.
      { path: 'plans', loadComponent: () => import('./pages/plans').then((m) => m.PlansComponent) },
    ],
  },
];

export default routes;
