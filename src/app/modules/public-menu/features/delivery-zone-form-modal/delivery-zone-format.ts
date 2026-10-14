import { DeliveryZoneDto, formatMenuPrice } from 'src/app/modules/public-menu/data-access';

/** "Envío $2.000 · Mínimo $10.000 · ~45 min". */
export function zoneSummary(zone: Pick<DeliveryZoneDto, 'fee' | 'minOrder' | 'etaMinutes'>): string {
  const parts = [zone.fee > 0 ? `Envío ${formatMenuPrice(zone.fee)}` : 'Envío gratis'];
  if (zone.minOrder > 0) parts.push(`Mínimo ${formatMenuPrice(zone.minOrder)}`);
  if (zone.etaMinutes) parts.push(`~${zone.etaMinutes} min`);
  return parts.join(' · ');
}

export const formatKm = (value: number) => `${String(Number(value)).replace('.', ',')} km`;
