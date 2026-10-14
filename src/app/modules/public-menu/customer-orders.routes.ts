import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    // Query params opcionales: tab (pending|history), locationId.
    loadComponent: () => import('./pages/customer-orders').then((m) => m.CustomerOrdersComponent),
  },
];

export default routes;
