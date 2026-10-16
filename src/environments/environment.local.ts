export const environment = {
  production: true,
  baseUrl: 'http://localhost:3000',
  // Bases de las APIs (en producción cambian por ambiente).
  authApiUrl: 'http://localhost:3000/auth/api',
  restaurantApiUrl: 'http://localhost:3000/restaurant/api',
  billingApiUrl: 'http://localhost:3000/billing/api',
  // Origen donde los clientes ven la carta pública (la landing): {publicSiteUrl}/carta/{negocio}/{local}.
  publicSiteUrl: 'http://localhost:4300',
  // Client ID de Google Identity Services (mismo valor que GOOGLE_CLIENT_ID del backend). Vacío = botón deshabilitado.
  googleClientId: '123525471493-h41blsi8tmhdcrqi0gh9qmdhf1217pgo.apps.googleusercontent.com',
  // Permisos en el front (ocultar menús, botones y rutas). Apagado hasta la etapa de permisos; el backend valida igual.
  enforcePermissions: true,
};
