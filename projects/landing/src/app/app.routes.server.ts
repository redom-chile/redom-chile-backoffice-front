import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // La carta depende de la API: se arma en el navegador (en Netlify, /carta/* sirve index.csr.html).
  { path: 'carta', renderMode: RenderMode.Client },
  { path: 'carta/**', renderMode: RenderMode.Client },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];
