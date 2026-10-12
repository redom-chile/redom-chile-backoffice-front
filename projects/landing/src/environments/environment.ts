// Desarrollo: la app (backoffice) corre en local con `npm start`.
export const environment = {
  appUrl: 'http://localhost:4200',
  siteUrl: 'http://localhost:4300',
  // Misma origen: `ng serve landing` lo redirige al backend local (proxy.conf.json), así no aplica CORS.
  billingApiUrl: '/billing/api',
};
