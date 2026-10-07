import { LotStatus } from '../../data-access';

/** Días de anticipación para "por vencer" (el backend acepta 1..365). */
export const EXPIRY_DAYS_OPTIONS = [3, 7, 15, 30] as const;
export const DEFAULT_EXPIRY_DAYS = 7;

const EXPIRY_DAYS_KEY = 'redom.inventory.expiryDays';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Días recordados en este navegador (localStorage puede fallar: modo privado, bloqueado). */
export function readExpiryDays(): number {
  try {
    const value = Number(localStorage.getItem(EXPIRY_DAYS_KEY));
    return (EXPIRY_DAYS_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_EXPIRY_DAYS;
  } catch {
    return DEFAULT_EXPIRY_DAYS;
  }
}

export function saveExpiryDays(days: number): void {
  try {
    localStorage.setItem(EXPIRY_DAYS_KEY, String(days));
  } catch {
    // Sin storage solo se pierde la preferencia.
  }
}

/** Días desde hoy (zona del navegador) hasta una fecha YYYY-MM-DD; negativo si ya pasó. */
export function daysUntil(isoDate: string): number | null {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(year, month - 1, day) - today) / DAY_MS);
}

/** "09/10" a partir de YYYY-MM-DD, sin pasar por zona horaria. */
export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [, month, day] = isoDate.slice(0, 10).split('-');
  return day && month ? `${day}/${month}` : isoDate;
}

/** "vence hoy", "en 3 días", "vencido hace 2 días". */
export function expiryDistanceLabel(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'vence hoy';
  if (days === 1) return 'vence mañana';
  if (days > 0) return `en ${days} días`;
  if (days === -1) return 'vencido ayer';
  return `vencido hace ${Math.abs(days)} días`;
}

export const LOT_STATUS_LABELS: Record<LotStatus, string> = {
  expired: 'Vencido',
  expiring: 'Por vencer',
  ok: 'Vigente',
  no_expiry: 'Sin vencimiento',
};

/** Chip de estado: rojo vencido, ámbar por vencer, verde vigente, gris sin vencimiento. */
export const LOT_STATUS_TONES: Record<LotStatus, string> = {
  expired: 'bg-red-500/15 text-red-700 dark:text-red-400',
  expiring: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ok: 'bg-green-500/15 text-green-700 dark:text-green-400',
  no_expiry: 'bg-muted text-muted-foreground',
};

/** Link para registrar la merma de lo vencido (la merma consume primero lo vencido: FEFO). */
export function wasteLinkParams(variationId: number, locationId: number | null): Record<string, string | number> {
  return { reason: 'waste', variationId, ...(locationId ? { locationId } : {}) };
}
