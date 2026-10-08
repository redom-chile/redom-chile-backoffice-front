import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'plans', pathMatch: 'full' },
      // Comparación de planes (el checkout llega en la próxima fase).
      { path: 'plans', loadComponent: () => import('./pages/plans').then((m) => m.PlansComponent) },
    ],
  },
];

export default routes;
