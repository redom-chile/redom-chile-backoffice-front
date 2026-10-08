import { environment } from '../environment';

export const ApiPathEnum = {
  AUTH: environment.authApiUrl,
  RESTAURANT: environment.restaurantApiUrl,
  // Planes, suscripciones y cobros (app billing del backend).
  BILLING: environment.billingApiUrl,
} as const;

export type ApiPathEnum = (typeof ApiPathEnum)[keyof typeof ApiPathEnum];
