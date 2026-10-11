import { ApiError } from 'src/app/core/utils';
import { getRoleErrorMessage } from '../../roles/data-access/role-error-message';

const BRANCH_NOT_FOUND = 'La sucursal seleccionada no existe en tu restaurante.';

/**
 * La sucursal inexistente llega como 404 con el código genérico NOT_FOUND (igual que un rol o usuario
 * inexistente), así que solo se distingue por el mensaje del backend.
 */
function isBranchNotFound(error: ApiError): boolean {
  return error.status === 404 && /branch/i.test(error.message);
}

export function getCreateUserErrorMessage(error: ApiError): string {
  if (isBranchNotFound(error)) return BRANCH_NOT_FOUND;
  if (error.code === 'ROLE_NOT_ASSIGNABLE') return getRoleErrorMessage(error) ?? '';
  const messages: Record<number, string> = {
    403: 'No puedes asignar alguno de esos roles.',
    404: 'Alguno de los roles ya no existe.',
    409: 'Ese email o RUT ya está registrado.',
  };
  return messages[error.status] ?? 'No se pudo enviar la invitación. Intenta nuevamente.';
}

export function getUpdateUserErrorMessage(error: ApiError): string {
  if (isBranchNotFound(error)) return BRANCH_NOT_FOUND;
  const messages: Record<number, string> = {
    404: 'El usuario ya no existe.',
    409: 'El usuario no pertenece a tu restaurante.',
  };
  return messages[error.status] ?? 'Algo salió mal. Por favor, vuelva a intentar.';
}
