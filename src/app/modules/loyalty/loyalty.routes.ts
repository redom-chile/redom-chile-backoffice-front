import { Routes } from '@angular/router';

// Query param opcional: tab (program|rewards|customers).
export default [
  {
    path: '',
    loadComponent: () => import('./pages/loyalty').then((m) => m.LoyaltyComponent),
  },
] satisfies Routes;
