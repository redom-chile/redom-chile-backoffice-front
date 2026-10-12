import { SubscriptionDetailDto, toSantiagoDateInput } from '../../data-access';

/** Datos que reciben los modales de acciones del detalle de un negocio. */
export type BusinessModalData = Readonly<{
  businessId: number;
  businessName: string;
  /** null: sin suscripción (usa el plan de respaldo). */
  subscription: SubscriptionDetailDto | null;
}>;

/** Ancho común de los modales del detalle. */
export const BUSINESS_MODAL_CONFIG = { width: '520px', maxWidth: '95vw', disableClose: true } as const;

/** Hoy (YYYY-MM-DD) en America/Santiago. */
export const todayInSantiago = () => toSantiagoDateInput(new Date().toISOString());

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
