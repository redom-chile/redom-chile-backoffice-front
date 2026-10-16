import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  // Carta pública de cada local (código compartido con el backoffice).
  { path: 'carta', loadChildren: () => import('src/app/modules/public-menu/carta/carta.routes').then((m) => m.CARTA_ROUTES) },
  { path: '**', redirectTo: '' },
];
