const time = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });
const dayTime = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "09:12" si es de hoy; "6 oct, 21:40" si no. */
export function formatCashSince(date: string | Date): string {
  const value = new Date(date);
  return value.toDateString() === new Date().toDateString() ? time.format(value) : dayTime.format(value);
}

/** "Caja principal · abierta por Juan desde las 09:12". */
export function cashSessionLabel(registerName: string, openedByName: string | null, openedAt: string): string {
  const since = formatCashSince(openedAt);
  const who = openedByName ? ` por ${openedByName}` : '';
  const at = since.includes(',') ? `desde el ${since}` : `desde las ${since}`;
  return `${registerName} · abierta${who} ${at}`;
}

/** Monto entero en CLP (los inputs pueden traer texto o decimales). */
export function toAmount(value: unknown): number {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}
