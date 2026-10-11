import { ApiError } from 'src/app/core/utils';
import { PERMISSION_DENIED } from 'src/app/core/permissions';

const PERMISSION_REASONS: Record<string, string> = {
  platform: 'Ese permiso es de la plataforma: un negocio no lo puede dar.',
  plan: 'Tu plan no incluye ese módulo.',
  not_owned: 'No puedes dar permisos que no tienes.',
};

const ROLE_REASONS: Record<string, string> = {
  not_of_business: 'Solo puedes asignar roles de tu negocio.',
  not_owned: 'Ese rol tiene permisos que no tienes.',
  user_has_more_permissions: 'Ese usuario tiene más permisos que tú: no puedes cambiar sus roles.',
  owner: 'Los roles del dueño no se cambian.',
};

/**
 * Mensaje para los errores de Roles y permisos (crear, editar o eliminar un rol, dar permisos o roles).
 * null para PERMISSION_DENIED: ese aviso lo muestra el interceptor.
 */
export function getRoleErrorMessage(error: ApiError, fallback = 'Algo salió mal. Por favor, vuelva a intentar.'): string | null {
  const reason = typeof error.details['reason'] === 'string' ? error.details['reason'] : '';
  switch (error.code) {
    case PERMISSION_DENIED:
      return null;
    case 'ROLE_NOT_EDITABLE':
      return 'Este rol es de Redom, no se puede modificar.';
    case 'ROLE_CODE_RESERVED':
      return 'Ese código está reservado. Usa otro.';
    case 'ROLE_IN_USE': {
      const users = Number(error.details['users']) || 0;
      return users > 0
        ? `Asigna otro rol a sus ${users} usuario${users === 1 ? '' : 's'} antes de eliminarlo.`
        : 'El rol tiene usuarios: asígnales otro rol antes de eliminarlo.';
    }
    case 'PERMISSION_NOT_ASSIGNABLE':
      return PERMISSION_REASONS[reason] ?? fallback;
    case 'ROLE_NOT_ASSIGNABLE':
      return ROLE_REASONS[reason] ?? fallback;
  }
  // Código de rol repetido en el negocio: 409 sin código propio.
  if (error.status === 409) return 'Ya existe un rol con ese código.';
  return fallback;
}
