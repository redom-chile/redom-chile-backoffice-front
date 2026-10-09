// Backend de producción aún no desplegado: confirmar la URL cuando exista.
const baseUrl = 'https://3rns8qoa8g.execute-api.us-east-1.amazonaws.com';

export const environment = {
  production: true,
  baseUrl,
  // Bases de las APIs (en producción cambian por ambiente).
  authApiUrl: `${baseUrl}/auth/api`,
  restaurantApiUrl: `${baseUrl}/restaurant/api`,
  // Ruta de cobros en AWS: por confirmar con el backend (se configura en una fase posterior).
  billingApiUrl: `${baseUrl}/billing/api`,
  // Client ID de Google Identity Services (mismo valor que GOOGLE_CLIENT_ID del backend). Vacío = botón deshabilitado.
  googleClientId: '329763575292-ba92a8perje6ctuq4va1a7k7vk8ud7hi.apps.googleusercontent.com',
  // Permisos en el front (ocultar menús, botones y rutas). Apagado hasta la etapa de permisos; el backend valida igual.
  enforcePermissions: false,
};
