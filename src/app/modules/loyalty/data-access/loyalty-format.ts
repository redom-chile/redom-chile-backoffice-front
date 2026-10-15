import { LoyaltyMechanic, LoyaltyMovementKind, RewardType, StampRule } from './dtos';

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-CL');

export const formatClp = (amount: number) => CLP.format(amount);

export const LOYALTY_MECHANIC_LABELS: Record<LoyaltyMechanic, string> = { points: 'Puntos', stamps: 'Sellos' };

export const STAMP_RULE_LABELS: Record<StampRule, string> = {
  visit: 'Por visita',
  product: 'Por producto',
  category: 'Por categoría',
};

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  discount_amount: 'Descuento $',
  discount_percent: 'Descuento %',
  free_product: 'Producto gratis',
};

export const REWARD_TYPE_ICONS: Record<RewardType, string> = {
  discount_amount: 'payments',
  discount_percent: 'percent',
  free_product: 'redeem',
};

export const MOVEMENT_KIND_LABELS: Record<LoyaltyMovementKind, string> = {
  earn: 'Compra',
  earn_reversal: 'Compra revertida',
  redeem: 'Canje',
  redeem_reversal: 'Canje revertido',
  adjust: 'Ajuste manual',
  expire: 'Vencimiento',
};

/** "1 punto", "12 sellos". Sin programa se usa "puntos". */
export function formatLoyaltyBalance(amount: number, mechanic: LoyaltyMechanic | null): string {
  const singular = mechanic === 'stamps' ? 'sello' : 'punto';
  return `${NUMBER.format(amount)} ${Math.abs(amount) === 1 ? singular : `${singular}s`}`;
}

/** "-50" / "+10". */
export function formatSigned(amount: number): string {
  return `${amount > 0 ? '+' : ''}${NUMBER.format(amount)}`;
}

/** Valor de la recompensa: "$2.000", "10%" o el producto. */
export function rewardValueLabel(reward: Readonly<{ rewardType: RewardType; value: number; productName: string | null }>): string {
  switch (reward.rewardType) {
    case 'discount_amount':
      return `${formatClp(reward.value)} de descuento`;
    case 'discount_percent':
      return `${reward.value}% de descuento`;
    default:
      return reward.productName ?? 'Producto eliminado';
  }
}

const DATE_TIME = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

export function formatLoyaltyDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME.format(date);
}
