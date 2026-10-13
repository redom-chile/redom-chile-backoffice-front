import { HttpStatusCode } from '@angular/common/http';
import { ApiError, ApiErrorCode } from 'src/app/core/utils';

// Mensajes por código de negocio del backend (tienen prioridad sobre el status HTTP).
const TABLE_ERROR_BY_CODE: Partial<Record<string, string>> = {
  [ApiErrorCode.TABLE_HAS_OPEN_ORDER]:
    'La mesa tiene un pedido abierto: su estado cambia solo cuando el pedido se cierra o se cancela.',
  [ApiErrorCode.TABLE_STATUS_AUTOMATIC]: 'Una mesa queda ocupada al recibir un pedido; no se puede marcar a mano.',
  [ApiErrorCode.TABLE_BLOCKED]: 'La mesa está bloqueada.',
  // Aún no está en ApiErrorCode (core).
  TABLE_NAME_TAKEN: 'Ya existe una mesa con ese nombre en el local. Cambia el prefijo.',
};

export function getTableErrorMessage(error: ApiError | undefined): string {
  const byCode = error?.code ? TABLE_ERROR_BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  switch (error?.status) {
    case HttpStatusCode.BadRequest:
      return 'Los datos ingresados no son válidos.';
    case HttpStatusCode.Forbidden:
      return 'No tienes permiso para esta acción.';
    case HttpStatusCode.NotFound:
      return 'La mesa no existe.';
    case HttpStatusCode.Conflict:
      return 'No se puede realizar la acción en el estado actual de la mesa.';
    default:
      return 'Error al actualizar la mesa. Intenta nuevamente.';
  }
}
