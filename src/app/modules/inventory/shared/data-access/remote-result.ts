import { catchError, map, Observable, of, OperatorFunction, pipe } from 'rxjs';

/** Resultado de una carga sin lanzar: así el error queda en el valor del resource y se puede mostrar. */
export type RemoteResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: unknown }>;

export function toRemoteResult<T>(): OperatorFunction<T, RemoteResult<T>> {
  return pipe(
    map((value): RemoteResult<T> => ({ ok: true, value })),
    catchError((error: unknown): Observable<RemoteResult<T>> => of({ ok: false, error })),
  );
}

export function resultValue<T>(result: RemoteResult<T> | undefined): T | null {
  return result?.ok ? result.value : null;
}

export function resultError<T>(result: RemoteResult<T> | undefined): unknown {
  return result && !result.ok ? result.error : null;
}
