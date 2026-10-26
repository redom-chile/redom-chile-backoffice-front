import { AutomationType, CampaignStatus, Segment, TemplateVariable } from './dtos';

// Mismos límites que el backend (messaging-rules / messaging.service).
export const SUBJECT_MAX = 120;
export const AUTOMATION_BODY_MAX = 2000;
export const CAMPAIGN_BODY_MAX = 5000;
export const CTA_LABEL_MAX = 40;
export const CAMPAIGN_NAME_MAX = 80;
export const PREHEADER_MAX = 150;
export const CTA_URL_MAX = 500;
export const SCHEDULE_MAX_DAYS = 60;
export const RANGES = { delayHours: [2, 72], daysBefore: [3, 30], cooldownDays: [1, 365] } as const;

export const HTTPS_URL = /^https:\/\/[^\s]+$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NUMBER = new Intl.NumberFormat('es-CL');
export const formatNumber = (value: number) => NUMBER.format(value);

export type AutomationInfo = Readonly<{ title: string; icon: string; when: string; field: 'delayHours' | 'daysBefore' | null }>;

export const AUTOMATION_INFO: Record<AutomationType, AutomationInfo> = {
  postVisitSurvey: {
    title: 'Encuesta después de la visita',
    icon: 'reviews',
    when: 'Unas horas después de pagar (en el POS o la carta), a clientes con correo.',
    field: 'delayHours',
  },
  loyaltyRewardAvailable: {
    title: 'Tienes una recompensa',
    icon: 'redeem',
    when: 'Cuando el saldo de fidelización alcanza una recompensa (una vez por recompensa y mes).',
    field: null,
  },
  loyaltyPointsExpiring: {
    title: 'Tus puntos vencen',
    icon: 'hourglass_bottom',
    when: 'Unos días antes de que venzan los puntos del cliente.',
    field: 'daysBefore',
  },
  winBack: {
    title: 'Te extrañamos',
    icon: 'favorite',
    when: 'Cuando el cliente pasa a "En riesgo": hace tiempo que no viene.',
    field: null,
  },
};

/** Textos de Redom (respaldo si nunca se vieron sin cambios en este navegador). */
export const AUTOMATION_FALLBACK_DEFAULTS: Record<AutomationType, Readonly<{ subject: string; body: string; ctaLabel: string | null }>> = {
  postVisitSurvey: {
    subject: '¿Cómo estuvo tu visita a {{businessName}}?',
    body: 'Hola {{customerName}}:\n\nGracias por visitarnos en {{locationName}}. Nos ayudas mucho si nos cuentas cómo te fue: toma menos de un minuto.',
    ctaLabel: 'Responder la encuesta',
  },
  loyaltyRewardAvailable: {
    subject: '¡Tienes una recompensa en {{businessName}}!',
    body: 'Hola {{customerName}}:\n\nYa juntaste **{{balance}}** y puedes canjear **{{rewardName}}** en tu próxima visita.',
    ctaLabel: 'Ver la carta',
  },
  loyaltyPointsExpiring: {
    subject: 'Tus puntos en {{businessName}} vencen pronto',
    body: 'Hola {{customerName}}:\n\nTienes **{{balance}}** que vencen el {{expiresAt}}. Vuelve antes para usarlos.',
    ctaLabel: 'Ver la carta',
  },
  winBack: {
    subject: 'Te extrañamos en {{businessName}}',
    body: 'Hola {{customerName}}:\n\nHace tiempo que no te vemos. Te esperamos en {{locationName}} con lo que más te gusta.',
    ctaLabel: 'Ver la carta',
  },
};

export const VARIABLE_LABELS: Record<TemplateVariable, string> = {
  customerName: 'Nombre del cliente',
  businessName: 'Negocio',
  locationName: 'Local',
  balance: 'Saldo',
  rewardName: 'Recompensa',
  expiresAt: 'Vencimiento',
  menuUrl: 'Enlace a la carta',
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  new: 'Nuevos',
  frequent: 'Frecuentes',
  atRisk: 'En riesgo',
  lost: 'Perdidos',
  vip: 'VIP',
  occasional: 'Ocasionales',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
  cancelled: 'Cancelada',
};

export const CAMPAIGN_STATUS_CLASSES: Record<CampaignStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  sending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  sent: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

export const isCampaignEditable = (status: CampaignStatus) => status === 'draft' || status === 'scheduled';

const SKIP_REASONS: Record<string, string> = {
  quotaExceeded: 'se acabó el cupo de correos del mes',
  quota: 'se acabó el cupo de correos del mes',
  suppressed: 'ese correo tuvo problemas antes (rebote o queja)',
  unsubscribed: 'ese correo se dio de baja',
  noConsent: 'no aceptó recibir novedades',
  disabled: 'la automatización está apagada',
  cooldown: 'ya recibió este correo hace poco',
  planFeature: 'tu plan no incluye la mensajería',
  cancelled: 'se canceló',
  providerError: 'el proveedor de correo no respondió',
};

export function testResultMessage(result: Readonly<{ email: string; status: string; reason: string | null }>): string {
  if (result.status === 'sent') return `Prueba enviada a ${result.email}. Revisa tu bandeja (y la carpeta de spam).`;
  const reason = result.reason ? (SKIP_REASONS[result.reason] ?? result.reason) : null;
  const what = result.status === 'failed' ? 'No se pudo enviar la prueba' : 'La prueba no se envió';
  return reason ? `${what}: ${reason}.` : `${what}.`;
}

// --- Fechas en la zona del negocio ---

export const DEFAULT_TIME_ZONE = 'America/Santiago';

function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: safeZone(timeZone) }).format(date);
}

type Parts = Readonly<{ year: number; month: number; day: number; hour: number; minute: number }>;

function partsIn(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - (date.getTime() - (date.getTime() % 60_000));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO → valor de <input type="datetime-local"> en la zona del negocio. */
export function toDateTimeInput(iso: string | Date | null, timeZone?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsIn(date, safeZone(timeZone));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Valor de <input type="datetime-local"> (hora de pared del negocio) → ISO; null si no es válido. */
export function fromDateTimeInput(value: string, timeZone?: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const zone = safeZone(timeZone);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = offsetMs(new Date(guess), zone);
  let time = guess - first;
  const second = offsetMs(new Date(time), zone);
  if (second !== first) time = guess - second;
  return new Date(time).toISOString();
}

export const CAMPAIGN_STAT_ITEMS = [
  { key: 'recipients', label: 'Destinatarios', icon: 'group' },
  { key: 'sent', label: 'Enviados', icon: 'send' },
  { key: 'opened', label: 'Aperturas', icon: 'drafts' },
  { key: 'clicked', label: 'Clics', icon: 'ads_click' },
  { key: 'unsubscribed', label: 'Bajas', icon: 'unsubscribe' },
  { key: 'bounced', label: 'Rebotes', icon: 'block' },
  { key: 'complained', label: 'Quejas (spam)', icon: 'report' },
  { key: 'failed', label: 'Fallidos', icon: 'error' },
  { key: 'skipped', label: 'Omitidos', icon: 'skip_next' },
] as const;

/** "120 destinatarios · 40 aperturas · 5 clics"; vacío si aún no hay datos. */
export function campaignStatsSummary(stats: Readonly<Partial<Record<string, number>>>): string {
  const parts: string[] = [];
  const add = (value: number | undefined, singular: string, plural: string) => {
    if (value === undefined) return;
    parts.push(`${formatNumber(value)} ${value === 1 ? singular : plural}`);
  };
  add(stats['recipients'], 'destinatario', 'destinatarios');
  add(stats['opened'], 'apertura', 'aperturas');
  add(stats['clicked'], 'clic', 'clics');
  if (stats['unsubscribed']) add(stats['unsubscribed'], 'baja', 'bajas');
  return parts.join(' · ');
}

/** Porcentaje sobre los enviados ("33 %"); null sin envíos. */
export function campaignRate(value: number | undefined, sent: number | undefined): string | null {
  if (!sent || value === undefined) return null;
  return `${Math.round((value / sent) * 100)} %`;
}
