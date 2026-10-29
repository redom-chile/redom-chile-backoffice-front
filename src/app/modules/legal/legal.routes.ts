import { Routes } from '@angular/router';
import { legalAcceptGuard } from 'src/app/core';

// Fuera del layout: "Antes de seguir" no carga nada del negocio y la lectura es pública.
const routes: Routes = [
  {
    path: 'accept',
    canActivate: [legalAcceptGuard],
    title: 'Antes de seguir · Redom',
    loadComponent: () => import('./pages/legal-accept/legal-accept.page').then((m) => m.LegalAcceptPage),
  },
  {
    path: ':code',
    loadComponent: () => import('./pages/legal-document/legal-document.page').then((m) => m.LegalDocumentPage),
  },
  // Sin código: "Mis documentos" en Mi perfil (sin sesión, el guard lleva al login).
  { path: '', pathMatch: 'full', redirectTo: '/profile' },
];

export default routes;
