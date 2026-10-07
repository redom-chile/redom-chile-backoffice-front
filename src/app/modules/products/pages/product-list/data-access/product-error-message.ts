import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { readApiError } from 'src/app/core/utils/api-error';
import { translateInventoryMessage } from 'src/app/modules/inventory/data-access';

export function getProductErrorMessage(status: HttpStatusCode | undefined): string {
  switch (status) {
    case HttpStatusCode.BadRequest:
      return 'Los datos ingresados no son válidos.';
    case HttpStatusCode.Forbidden:
      return 'No tienes permiso para esta acción.';
    case HttpStatusCode.NotFound:
      return 'El producto o la categoría no existen.';
    case HttpStatusCode.Conflict:
      return 'Ya existe un producto con ese SKU o no se puede completar la acción.';
    default:
      return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}

/** Igual que getProductErrorMessage, pero traduce las reglas de inventario (unidad, recetas, ingredientes). */
export function getProductSaveErrorMessage(status: HttpStatusCode | undefined, error: HttpErrorResponse | null): string {
  const message = readApiError(error).message;
  const translated = message ? translateInventoryMessage(message) : '';
  return translated && translated !== message ? translated : getProductErrorMessage(status);
}
