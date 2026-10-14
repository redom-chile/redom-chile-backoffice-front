import { Routes } from '@angular/router';

/**
 * Carta pública (sin sesión). La landing la monta en /carta; el código es compartido para que el backoffice pueda
 * reutilizar la vista (CartaMenuView) como vista previa.
 */
export const CARTA_ROUTES: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./ui/carta-states').then((m) => m.CartaUnavailable) },
  { path: ':slug', loadComponent: () => import('./pages/carta-business.page').then((m) => m.CartaBusinessPage) },
  { path: ':business/:location', loadComponent: () => import('./pages/carta-menu.page').then((m) => m.CartaMenuPage) },
];
