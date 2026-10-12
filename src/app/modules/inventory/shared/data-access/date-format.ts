const dateTime = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Fecha de documento (YYYY-MM-DD) como dd-mm-aaaa, sin pasar por zona horaria. */
export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}-${month}-${year}` : value;
}

/** Fecha y hora local de un movimiento o registro. */
export function formatDateTimeFull(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : '—';
}
