import { Routes } from '@angular/router';

/**
 * Carta pública (sin sesión). La landing la monta en /carta; el código es compartido para que el backoffice pueda
 * reutilizar la vista (CartaMenuView) como vista previa.
 */
export const CARTA_ROUTES: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./ui/carta-states').then((m) => m.CartaUnavailable) },
  // Etapa 5: seguimiento de retiro / delivery (los correos enlazan a {QR_BASE_URL}/pedido/{id}). Antes de las rutas con slug
  { path: 'pedido/:id', loadComponent: () => import('./pages/carta-order.page').then((m) => m.CartaOrderPage) },
  // Etapa 10.2: páginas que enlazan los correos del negocio ({URL_CORS}/carta/encuesta|baja?token=…)
  { path: 'encuesta', loadComponent: () => import('./pages/carta-survey.page').then((m) => m.CartaSurveyPage) },
  { path: 'baja', loadComponent: () => import('./pages/carta-unsubscribe.page').then((m) => m.CartaUnsubscribePage) },
  { path: ':slug', loadComponent: () => import('./pages/carta-business.page').then((m) => m.CartaBusinessPage) },
  { path: ':business/:location', loadComponent: () => import('./pages/carta-menu.page').then((m) => m.CartaMenuPage) },
];
