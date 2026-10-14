export const environment = {
  appUrl: 'https://app.redom.cl',
  siteUrl: 'https://redom.cl',
  // Misma origen: Netlify lo redirige a la API (netlify.toml), así no aplica CORS.
  billingApiUrl: '/billing/api',
  // Carta pública (API sin sesión), también por el mismo origen.
  publicMenuApiUrl: '/restaurant/api/public/v1',
};
