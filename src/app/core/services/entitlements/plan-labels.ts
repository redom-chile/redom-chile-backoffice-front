import { PlanFeatureCode, PlanLimitCode } from './dtos';

/** Nombres para los mensajes (el plan y sus funciones vienen del backend; esto es el respaldo). */
export const PLAN_FEATURE_LABELS: Record<PlanFeatureCode, string> = {
  pos: 'Punto de venta',
  kitchen_display: 'Pantalla de cocina',
  qr_menu: 'Carta digital con QR',
  help_assistant: 'Asistente con IA',
  cash: 'Caja y turnos',
  bookings: 'Reservas',
  printing: 'Impresión de comandas',
  reports: 'Reportes y liquidaciones',
  inventory: 'Inventario',
  recipes: 'Recetas y food cost',
  finance: 'Finanzas',
  tips: 'Propinas',
  multi_location: 'Varios locales',
};

export const PLAN_LIMIT_LABELS: Record<PlanLimitCode, { one: string; many: string }> = {
  max_locations: { one: 'local', many: 'locales' },
  max_users: { one: 'usuario', many: 'usuarios' },
  max_registers: { one: 'caja', many: 'cajas' },
  ai_questions_month: { one: 'pregunta al asistente', many: 'preguntas al asistente' },
};

/** "1 de 3 locales" / "2 locales (ilimitado)". */
export function formatPlanUsage(code: PlanLimitCode, used: number, limit: number | null): string {
  const label = PLAN_LIMIT_LABELS[code];
  if (limit === null) return `${used} ${used === 1 ? label.one : label.many} (ilimitado)`;
  return `${used} de ${limit} ${limit === 1 ? label.one : label.many}`;
}
