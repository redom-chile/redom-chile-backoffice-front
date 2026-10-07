import { ParamMap } from '@angular/router';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Página válida (>= 1) desde la URL. */
export function readPage(params: ParamMap): number {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Id entero positivo desde la URL, o null. */
export function readId(params: ParamMap, key: string): number | null {
  const value = Number(params.get(key));
  return params.get(key) && Number.isInteger(value) && value > 0 ? value : null;
}

/** Fecha YYYY-MM-DD desde la URL, o null. */
export function readDate(params: ParamMap, key: string): string | null {
  const value = params.get(key);
  return value && DATE_PATTERN.test(value) ? value : null;
}

/** Valor de una lista cerrada desde la URL, o null. */
export function readOption<T extends string>(params: ParamMap, key: string, options: readonly T[]): T | null {
  const value = params.get(key);
  return value && (options as readonly string[]).includes(value) ? (value as T) : null;
}
