import { PLAN_FEATURE_LABELS, PLAN_LIMIT_LABELS, PlanFeatureCode, PlanLimitCode, SubscriptionStatus } from 'src/app/core/services/entitlements';
import { BillingEventDto, formatPlatformDate, SUBSCRIPTION_STATUS_LABELS } from '../../data-access';

type DatesSource = Readonly<{
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
}>;

export type KeyDate = Readonly<{ label: string; date: string | null; past: boolean }>;

/** La fecha que importa según el estado: fin de la prueba, del período o de la gracia. */
export function subscriptionKeyDate(source: DatesSource): KeyDate | null {
  const pick = (label: string, date: string | null): KeyDate => ({ label, date, past: !!date && new Date(date).getTime() <= Date.now() });
  switch (source.status) {
    case 'trialing':
      return pick('Prueba hasta', source.trialEndsAt);
    case 'active':
      return pick(source.cancelAtPeriodEnd ? 'Se cancela el' : 'Período hasta', source.currentPeriodEnd);
    case 'past_due':
      return pick('Gracia hasta', source.graceEndsAt);
    case 'expired':
    case 'cancelled':
      return source.currentPeriodEnd ? pick('Período terminó', source.currentPeriodEnd) : source.trialEndsAt ? pick('Prueba terminó', source.trialEndsAt) : null;
    default:
      return null;
  }
}

export const featureLabel = (code: string | null | undefined) => (code ? (PLAN_FEATURE_LABELS[code as PlanFeatureCode] ?? code) : '—');
export const limitLabel = (code: string | null | undefined) => {
  if (!code) return '—';
  const label = PLAN_LIMIT_LABELS[code as PlanLimitCode]?.many;
  return label ? `Máximo de ${label}` : code;
};

// --- Historial (billing_events) ---

export const EVENT_TYPE_LABELS: Record<string, string> = {
  billing_data_read: 'Consulta de los datos de cobro',
  subscription_created: 'Suscripción creada',
  subscription_updated: 'Suscripción modificada',
  subscription_expired: 'Suscripción vencida',
  subscription_cancelled: 'Suscripción cancelada',
  trial_extended: 'Prueba extendida',
  discount_applied: 'Descuento asignado',
  discount_removed: 'Descuento quitado',
  override_created: 'Excepción agregada',
  override_removed: 'Excepción terminada',
};

export const EVENT_ACTOR_LABELS: Record<BillingEventDto['actorRole'], string> = {
  owner: 'Dueño',
  superadmin: 'Equipo Redom',
  system: 'Sistema',
};

const FIELD_LABELS: Record<string, string> = {
  planId: 'Plan',
  priceId: 'Precio',
  status: 'Estado',
  trialEndsAt: 'Fin de la prueba',
  currentPeriodStart: 'Inicio del período',
  currentPeriodEnd: 'Fin del período',
  graceEndsAt: 'Fin de la gracia',
  scheduledPlanId: 'Plan programado',
  notes: 'Nota',
  discountId: 'Descuento',
  previousDiscountId: 'Descuento anterior',
  code: 'Código',
  periods: 'Cobros con descuento',
  overrideId: 'Excepción',
  featureCode: 'Función',
  limitCode: 'Límite',
  limitValue: 'Valor',
  expiresAt: 'Termina',
  reason: 'Motivo',
  from: 'Antes',
  to: 'Después',
};

// Ids internos que no aportan a la lectura.
const HIDDEN_FIELDS = new Set(['subscriptionId', 'view']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
const MAX_VALUE = 80;

export type EventContext = Readonly<{ planNames: ReadonlyMap<number, string> }>;

function formatValue(key: string, value: unknown, context: EventContext): string {
  if (value === null || value === undefined || value === '') {
    if (key === 'limitValue') return 'Ilimitado';
    if (key === 'expiresAt') return 'Sin término';
    return '—';
  }
  if ((key === 'planId' || key === 'scheduledPlanId') && typeof value === 'number') return context.planNames.get(value) ?? `#${value}`;
  if (key === 'status' && typeof value === 'string') return SUBSCRIPTION_STATUS_LABELS[value as SubscriptionStatus] ?? value;
  if (key === 'featureCode' && typeof value === 'string') return featureLabel(value);
  if (key === 'limitCode' && typeof value === 'string') return limitLabel(value);
  if (typeof value === 'string' && ISO_DATE.test(value)) return formatPlatformDate(value, true);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return truncate(String(value));
  if (Array.isArray(value)) return truncate(value.map((item) => formatValue('', item, context)).join(', '));
  return truncate(JSON.stringify(value));
}

const truncate = (text: string) => (text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text);

/**
 * Resumen legible del `data` de un evento, una línea por campo:
 * los cambios de la suscripción como "Estado: Activa → Vencida".
 */
export function summarizeEvent(event: BillingEventDto, context: EventContext): string[] {
  const data = event.data ?? {};
  const changes = data['changes'];
  const lines: string[] = [];
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    for (const [key, change] of Object.entries(changes as Record<string, unknown>)) {
      const { from, to } = (change ?? {}) as { from?: unknown; to?: unknown };
      lines.push(`${FIELD_LABELS[key] ?? key}: ${formatValue(key, from, context)} → ${formatValue(key, to, context)}`);
    }
  }
  // trial_extended trae { from, to } de la fecha de término.
  if (event.type === 'trial_extended') {
    return [`Fin de la prueba: ${formatValue('trialEndsAt', data['from'], context)} → ${formatValue('trialEndsAt', data['to'], context)}`];
  }
  for (const [key, value] of Object.entries(data)) {
    if (key === 'changes' || HIDDEN_FIELDS.has(key)) continue;
    lines.push(`${FIELD_LABELS[key] ?? key}: ${formatValue(key, value, context)}`);
  }
  return lines;
}
