import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { MenuSortMode } from 'src/app/core/services/business-settings';
import { readApiError } from 'src/app/core/utils/api-error';

export const REORDER_UNAVAILABLE_MESSAGE = 'El orden manual estará disponible cuando el servidor lo publique (#68).';

/** El endpoint de orden aún no existe en el servidor (404/405). */
export function isReorderUnavailable(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === HttpStatusCode.NotFound || error.status === HttpStatusCode.MethodNotAllowed)
  );
}

export function getReorderErrorMessage(error: unknown): string {
  if (isReorderUnavailable(error)) return REORDER_UNAVAILABLE_MESSAGE;
  const { status, code } = readApiError(error);
  if (code === 'REORDER_IDS_MISMATCH') return 'La lista cambió mientras ordenabas. Actualizamos el orden: inténtalo de nuevo.';
  if (status === HttpStatusCode.Forbidden) return 'No tienes permiso para cambiar el orden.';
  return 'No se pudo guardar el orden. Intenta nuevamente.';
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Manual: por posición y luego nombre (sin posición van al final). Alfabético: por nombre. */
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

// Ícono y nota del chef (etapa 8): si el servidor aún no los guarda, se avisa una sola vez por sesión.
export const STAGE8_PENDING_MESSAGE = 'Se guardará cuando el servidor publique la etapa 8';
let stage8Pending = false;
let stage8Notified = false;

export function markStage8Pending() {
  if (!stage8Notified) stage8Pending = true;
}

/** Devuelve el aviso si hay uno pendiente (y lo da por mostrado). */
export function takeStage8Notice(): string | null {
  if (!stage8Pending) return null;
  stage8Pending = false;
  stage8Notified = true;
  return STAGE8_PENDING_MESSAGE;
}
