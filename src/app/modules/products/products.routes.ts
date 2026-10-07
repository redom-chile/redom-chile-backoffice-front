import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core';

const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('./pages/product-list/product-list.routes'),
      },
      {
        path: 'categories',
        loadChildren: () => import('./pages/categories/categories.routes'),
      },
      {
        path: 'modifiers',
        loadChildren: () => import('./pages/modifiers/modifiers.routes'),
      },
    ],
  },
];

export default routes;
