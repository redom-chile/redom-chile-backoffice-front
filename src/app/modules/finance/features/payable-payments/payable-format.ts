const day = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const dayTime = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Fecha de calendario (YYYY-MM-DD o ISO) sin correr el día por la zona horaria: "05 oct 2026". */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, date] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !date) return value;
  return day.format(new Date(year, month - 1, date));
}

/** Fecha y hora de un pago: "05 oct 2026, 14:30". */
export function formatPaidAt(value: string | null | undefined): string {
  return value ? dayTime.format(new Date(value)) : '—';
}

/** YYYY-MM-DD local de hoy + n días. */
export function localDate(addDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
