import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { MenuSortMode } from 'src/app/core/services/business-settings';
import { readApiError } from 'src/app/core/utils/api-error';

export const REORDER_UNAVAILABLE_MESSAGE = 'El orden manual no está disponible en el servidor. Intenta más tarde.';

/** La ruta de orden no existe en el servidor (405, o 404 "Cannot PATCH ..." / sin cuerpo). */
export function isReorderUnavailable(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  if (error.status === HttpStatusCode.MethodNotAllowed) return true;
  const { message } = readApiError(error);
  return error.status === HttpStatusCode.NotFound && (!message || message.startsWith('Cannot '));
}

export function getReorderErrorMessage(error: unknown): string {
  const { status, code } = readApiError(error);
  if (code === 'REORDER_IDS_MISMATCH') return 'La lista cambió mientras ordenabas. Actualizamos el orden: inténtalo de nuevo.';
  if (isReorderUnavailable(error)) return REORDER_UNAVAILABLE_MESSAGE;
  // 404 del backend: la categoría ya no existe (o no es del negocio).
  if (status === HttpStatusCode.NotFound) return 'La categoría ya no existe. Actualiza la lista.';
  if (status === HttpStatusCode.Forbidden) return 'No tienes permiso para cambiar el orden.';
  return 'No se pudo guardar el orden. Intenta nuevamente.';
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Manual: por posición y luego nombre (igual que el backend). Alfabético: por nombre. */
export function sortForMenu<T extends Readonly<{ name: string; position?: number }>>(items: readonly T[], mode: MenuSortMode): T[] {
  return [...items].sort((a, b) => {
    if (mode === 'manual') {
      const diff = (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER);
      if (diff !== 0) return diff;
    }
    return collator.compare(a.name, b.name);
  });
}

/** Copia con el elemento movido de `from` a `to`. */
export function moveInList<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  if (from === to || from < 0 || to < 0 || from >= copy.length || to >= copy.length) return copy;
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

type CategoryNode = Readonly<{ name: string; position?: number; subcategories?: readonly CategoryNode[] }>;

/** Árbol de categorías en el orden de la carta (principales y subcategorías de cada una). */
export function sortCategoryTree<T extends CategoryNode>(categories: readonly T[], mode: MenuSortMode): T[] {
  return sortForMenu(categories, mode).map((category) =>
    category.subcategories?.length ? { ...category, subcategories: sortForMenu(category.subcategories, mode) } : category,
  );
}
