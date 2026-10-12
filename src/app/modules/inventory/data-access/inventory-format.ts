const money = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
// Costos unitarios por unidad base pueden ser fraccionarios (ej. $9,33 por g).
const unitMoney = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 4 });

/** Totales y valores: sin decimales. */
export function formatMoney(value: number | null | undefined): string {
  return money.format(Number(value ?? 0));
}

/** Costo unitario / promedio: hasta 2 decimales. */
export function formatUnitCost(value: number | null | undefined): string {
  return unitMoney.format(Number(value ?? 0));
}

export function formatQuantity(value: number | null | undefined, unit?: string | null): string {
  const text = quantity.format(Number(value ?? 0));
  return unit ? `${text} ${unit}` : text;
}

/** Cantidad con signo explícito para el kardex (+500 / −500). */
export function formatSignedQuantity(value: number, unit?: string | null): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatQuantity(Math.abs(value), unit)}`;
}

/** Hoy en la zona del navegador, YYYY-MM-DD (fecha por defecto de compras/ajustes y filtros). */
export function todayIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
