/** Umbrales del food cost % (referencia habitual en restaurantes: 25–35 %). Se pueden ajustar aquí. */
export const FOOD_COST_THRESHOLDS = { good: 30, warning: 40 } as const;

export type FoodCostLevel = 'good' | 'warning' | 'high' | 'none';

export function foodCostLevel(percent: number | null | undefined): FoodCostLevel {
  if (percent === null || percent === undefined) return 'none';
  if (percent <= FOOD_COST_THRESHOLDS.good) return 'good';
  if (percent <= FOOD_COST_THRESHOLDS.warning) return 'warning';
  return 'high';
}

/** Clases de texto y fondo por nivel (verde ≤ 30, amarillo ≤ 40, rojo > 40). */
export const FOOD_COST_LEVEL_CLASSES: Record<FoodCostLevel, string> = {
  good: 'bg-green-500/10 text-green-700 dark:text-green-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  high: 'bg-red-500/10 text-red-700 dark:text-red-400',
  none: 'bg-[var(--muted)] text-muted-foreground',
};
