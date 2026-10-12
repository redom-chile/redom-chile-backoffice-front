const time = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

/** Hora local (09:12). */
export function formatTime(value: string | null | undefined): string {
  return value ? time.format(new Date(value)) : '—';
}

export type DifferenceTone = 'short' | 'over' | 'even' | 'none';

/** Diferencia contado − esperado: negativa = faltante, positiva = sobrante. */
export function differenceTone(value: number | null | undefined): DifferenceTone {
  if (value === null || value === undefined) return 'none';
  return value < 0 ? 'short' : value > 0 ? 'over' : 'even';
}

export const DIFFERENCE_CLASSES: Record<DifferenceTone, string> = {
  short: 'text-red-600 dark:text-red-400',
  over: 'text-green-600 dark:text-green-400',
  even: 'text-foreground',
  none: 'text-muted-foreground',
};
