import {
  formatMenuPrice,
  PriceChannel,
  PromotionDiscountType,
  PromotionDto,
  PromotionTargetType,
} from 'src/app/modules/public-menu/data-access';

export const TARGET_TYPE_LABELS: Record<PromotionTargetType, string> = {
  product: 'Producto',
  variation: 'Variación',
  category: 'Categoría',
};

export const DISCOUNT_TYPE_LABELS: Record<PromotionDiscountType, string> = {
  percent: 'Porcentaje',
  amount: 'Descuento en $',
  fixed_price: 'Precio fijo',
};

export const CHANNEL_LABELS: Record<PriceChannel, string> = { in_store: 'En el local', online: 'Online' };

const PERCENT = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** "20%", "-$2.000" o "$9.990". */
export function formatDiscount(promotion: Pick<PromotionDto, 'discountType' | 'value'>): string {
  const value = Number(promotion.value);
  if (promotion.discountType === 'percent') return `${PERCENT.format(value)}%`;
  if (promotion.discountType === 'amount') return `-${formatMenuPrice(value)}`;
  return formatMenuPrice(value);
}
