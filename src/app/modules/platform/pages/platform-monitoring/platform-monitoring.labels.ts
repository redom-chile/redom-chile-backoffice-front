import { MonitoredService, ServiceStatus } from '../../data-access';

export const MONITORED_SERVICES: readonly MonitoredService[] = ['auth', 'restaurant', 'billing'];

export const SERVICE_LABELS: Record<MonitoredService, Readonly<{ name: string; description: string }>> = {
  auth: { name: 'Auth', description: 'Login, sesiones y usuarios' },
  restaurant: { name: 'Restaurant', description: 'Backoffice, POS y carta pública' },
  billing: { name: 'Billing', description: 'Planes, suscripciones y cobros' },
};

export const STATUS_LABELS: Record<ServiceStatus, Readonly<{ label: string; classes: string; dot: string }>> = {
  up: {
    label: 'Operativo',
    classes: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  degraded: {
    label: 'Con problemas',
    classes: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  down: { label: 'Caído', classes: 'bg-red-500/15 text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  unknown: { label: 'Sin datos', classes: 'bg-slate-500/15 text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
};

/** 99,95 % (null: sin chequeos). */
export function formatUptime(value: number | null): string {
  if (value === null) return '—';
  const digits = value === 100 ? 0 : value >= 99 ? 2 : 1;
  return `${value.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

export function uptimeTone(value: number | null): string {
  if (value === null) return 'text-muted-foreground';
  if (value >= 99.9) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 99) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value >= 1000 ? `${(value / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} s` : `${value} ms`;
}

/** 3 min, 2 h 15 min, 1 d 4 h. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} d${hours % 24 ? ` ${hours % 24} h` : ''}`;
}

/** "hace 40 s", "hace 3 min", "hace 2 h". */
export function formatAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'nunca';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('es-CL');
}
