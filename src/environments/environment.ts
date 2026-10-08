// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  baseUrl: `http://localhost:3000`,
  // Bases de las APIs (en producción cambian por ambiente).
  authApiUrl: 'http://localhost:3000/auth/api',
  restaurantApiUrl: 'http://localhost:3000/restaurant/api',
  billingApiUrl: 'http://localhost:3000/billing/api',
  // Client ID de Google Identity Services (mismo valor que GOOGLE_CLIENT_ID del backend). Vacío = botón deshabilitado.
  googleClientId: '329763575292-ba92a8perje6ctuq4va1a7k7vk8ud7hi.apps.googleusercontent.com',
  // Permisos en el front (ocultar menús, botones y rutas). Apagado hasta la etapa de permisos; el backend valida igual.
  enforcePermissions: false,
  // baseUrl: `http://192.168.4.31:3000`,
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
