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
      // Etapa 9: Mejorar mi carta con IA. Query param opcional: tab (overview|descriptions|tags|insights|settings).
      {
        path: 'improve',
        loadComponent: () => import('./pages/menu-ai').then((m) => m.MenuAiComponent),
      },
      {
        path: 'modifiers',
        loadChildren: () => import('./pages/modifiers/modifiers.routes'),
      },
    ],
  },
];

export default routes;
