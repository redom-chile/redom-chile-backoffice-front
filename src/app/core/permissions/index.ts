import { AUTH_PERMISSIONS } from './auth.permissions';
import { BILLING_PERMISSIONS } from './billing.permissions';
import { RESTAURANT_PERMISSIONS } from './restaurant.permissions';

export * from './auth.permissions';
export * from './restaurant.permissions';
export * from './billing.permissions';

/**
 * Todos los permisos del front. Se definen separados por servicio (como en el backend) y se usan desde aquí:
 * whoami entrega una sola lista, así que a la pantalla no le importa de qué servicio viene cada código.
 * Uso: `*appCheckPermission="PERMISSIONS.ORDERS.CANCEL_ORDER"`. Cada módulo tiene `SEE_MODULE` (menú) y sus acciones (botones).
 */
export const PERMISSIONS = {
  ...AUTH_PERMISSIONS,
  ...RESTAURANT_PERMISSIONS,
  ...BILLING_PERMISSIONS,
} as const;

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T];

/** Código de permiso válido (`modulo:accion`). Un código mal escrito no compila. */
export type PermissionCode = Leaves<typeof PERMISSIONS>;

export * from './access.service';
export * from './permission-routes';
export * from './permission-error.interceptor';
