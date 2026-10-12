/** Zona horaria en que el backend agrupa y filtra las fechas del asistente. */
export const HELP_TIME_ZONE = 'America/Santiago';

/** Rango máximo que acepta GET /help/admin/usage. */
export const HELP_USAGE_MAX_DAYS = 366;

const integer = new Intl.NumberFormat('es-CL');

const dateTime = new Intl.DateTimeFormat('es-CL', {
  timeZone: HELP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: HELP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Costo en dólares: "US$0,0012" (hasta 6 decimales, mínimo 2). */
export function formatUsd(value: number | null | undefined, maxDecimals = 6): string {
  const amount = Number(value ?? 0);
  return `US$${amount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals })}`;
}

/** Costo para totales: 2 decimales si pasa de 1 dólar, si no hasta 4. */
export function formatUsdTotal(value: number | null | undefined): string {
  return formatUsd(value, Math.abs(Number(value ?? 0)) >= 1 ? 2 : 4);
}

export function formatInteger(value: number | null | undefined): string {
  return integer.format(Number(value ?? 0));
}

/** Fecha y hora en hora de Chile. */
export function formatHelpDateTime(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : '—';
}

/** Hoy (YYYY-MM-DD) en hora de Chile. */
export function todayInChile(): string {
  return isoDay.format(new Date());
}

/** Suma días a una fecha YYYY-MM-DD (sin pasar por zona horaria). */
export function addDaysIso(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Días del rango, ambos incluidos. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
