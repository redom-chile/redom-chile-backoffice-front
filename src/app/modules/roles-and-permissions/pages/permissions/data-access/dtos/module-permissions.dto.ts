import { PermissionDto } from './permission.dto';

export type ModulePermissionsDto = Readonly<{
  moduleId: number;
  moduleName: string;
  /** Prefijo de sus permisos en mayúsculas (ej. `PURCHASE-ORDERS`); se cruza con `entitlements.lockedModules`. */
  moduleCode: string;
  /** `platform`: solo del equipo de Redom (un negocio no los recibe). */
  moduleScope: 'business' | 'platform';
  permissions: ReadonlyArray<Omit<PermissionDto, 'moduleId' | 'moduleName'>>;
}>;
