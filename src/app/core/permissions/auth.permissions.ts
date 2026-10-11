/** Permisos del servicio auth. Copia de `Permission.AUTH` (backend: libs/auth/enums/permission.enum.ts): mantener igual. */
export const AUTH_PERMISSIONS = {
  MODULES: {
    SEE_MODULE: 'modules:see-module',
    GET_ALL_MODULES: 'modules:get-all-modules',
    CREATE_MODULE: 'modules:create-module',
    UPDATE_MODULE: 'modules:update-module',
    DELETE_MODULE: 'modules:delete-module',
  },
  PERMISSIONS: {
    SEE_MODULE: 'permissions:see-module',
    GET_ALL_PERMISSIONS: 'permissions:get-all-permissions',
    CREATE_PERMISSION: 'permissions:create-permission',
    UPDATE_PERMISSION: 'permissions:update-permission',
    DELETE_PERMISSION: 'permissions:delete-permission',
  },
  ROLES: {
    SEE_MODULE: 'roles:see-module',
    GET_ALL_ROLES: 'roles:get-all-roles',
    CREATE_ROLE: 'roles:create-role',
    UPDATE_ROLE: 'roles:update-role',
    DELETE_ROLE: 'roles:delete-role',
  },
  ROLES_PERMISSIONS: {
    SEE_MODULE: 'roles-permissions:see-module',
    GET_ROLE_PERMISSIONS: 'roles-permissions:get-role-permissions',
    // Reemplaza todos los permisos del rol (para quitar uno, se envía la lista sin él).
    ASSIGN_PERMISSION: 'roles-permissions:assign-permissions',
  },
  USER_ROLES: {
    SEE_MODULE: 'users-roles:see-module',
    GET_USER_ROLES: 'users-roles:get-user-roles',
    ASSIGN_ROLE: 'users-roles:assign-roles',
  },
  USERS: {
    SEE_MODULE: 'users:see-module',
    GET_ALL_USERS: 'users:get-all-users',
    GET_USER: 'users:get-user',
    CREATE_USER: 'users:create-user',
    UPDATE_USER: 'users:update-user',
    DELETE_USER: 'users:delete-user',
    DEACTIVATE_USER: 'users:deactivate-user',
    SET_STAFF_PIN: 'users:set-staff-pin',
  },
  CONTACTS: {
    SEE_MODULE: 'contacts:see-module',
    GET_ALL_CONTACTS: 'contacts:get-all-contacts',
    CREATE_CONTACT: 'contacts:create-contact',
    UPDATE_CONTACT: 'contacts:update-contact',
    DELETE_CONTACT: 'contacts:delete-contact',
  },
} as const;
