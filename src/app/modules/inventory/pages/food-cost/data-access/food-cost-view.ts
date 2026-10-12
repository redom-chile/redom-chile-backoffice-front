import { FoodCostItemDto } from '../../../data-access';

export type FoodCostSortKey = 'percent' | 'margin' | 'name';
export type FoodCostSortDir = 'asc' | 'desc';
export type FoodCostSort = Readonly<{ key: FoodCostSortKey; dir: FoodCostSortDir }>;

// Orden del backend: % de mayor a menor (sin precio al final).
export const DEFAULT_FOOD_COST_SORT: FoodCostSort = { key: 'percent', dir: 'desc' };

export const FOOD_COST_SORT_OPTIONS: ReadonlyArray<Readonly<{ value: string; label: string; sort: FoodCostSort }>> = [
  { value: 'percent-desc', label: 'Food cost % (mayor primero)', sort: { key: 'percent', dir: 'desc' } },
  { value: 'percent-asc', label: 'Food cost % (menor primero)', sort: { key: 'percent', dir: 'asc' } },
  { value: 'margin-asc', label: 'Margen (menor primero)', sort: { key: 'margin', dir: 'asc' } },
  { value: 'margin-desc', label: 'Margen (mayor primero)', sort: { key: 'margin', dir: 'desc' } },
  { value: 'name-asc', label: 'Nombre (A–Z)', sort: { key: 'name', dir: 'asc' } },
  { value: 'name-desc', label: 'Nombre (Z–A)', sort: { key: 'name', dir: 'desc' } },
];

export function sortValue(sort: FoodCostSort): string {
  return `${sort.key}-${sort.dir}`;
}

export function parseSort(value: string | null): FoodCostSort {
  return FOOD_COST_SORT_OPTIONS.find((option) => option.value === value)?.sort ?? DEFAULT_FOOD_COST_SORT;
}

export function hasWarning(item: FoodCostItemDto): boolean {
  return item.missingRecipe || item.missingCost;
}

const collator = new Intl.Collator('es-CL', { sensitivity: 'base', numeric: true });

/** Orden en el cliente; los valores nulos (sin precio) siempre quedan al final. */
export function sortFoodCost(items: readonly FoodCostItemDto[], sort: FoodCostSort): FoodCostItemDto[] {
  if (sort.key === DEFAULT_FOOD_COST_SORT.key && sort.dir === DEFAULT_FOOD_COST_SORT.dir) return [...items];
  const factor = sort.dir === 'asc' ? 1 : -1;
  if (sort.key === 'name') return [...items].sort((a, b) => factor * collator.compare(a.itemName, b.itemName));
  const pick = (item: FoodCostItemDto) => (sort.key === 'percent' ? item.foodCostPercent : item.margin);
  return [...items].sort((a, b) => {
    const va = pick(a);
    const vb = pick(b);
    if (va === null && vb === null) return collator.compare(a.itemName, b.itemName);
    if (va === null) return 1;
    if (vb === null) return -1;
    return factor * (va - vb) || collator.compare(a.itemName, b.itemName);
  });
}

export type FoodCostSummary = Readonly<{
  analyzed: number;
  // Ponderado: Σ costo / Σ precio sin IVA × 100 (solo filas con precio y receta).
  averagePercent: number | null;
  averageMargin: number | null;
  withWarnings: number;
}>;

export function summarizeFoodCost(items: readonly FoodCostItemDto[]): FoodCostSummary {
  // Un plato sin receta tiene costo 0: distorsionaría el promedio.
  const priced = items.filter((item) => !item.missingRecipe && item.netPrice !== null && item.netPrice > 0);
  const totalCost = priced.reduce((sum, item) => sum + item.cost, 0);
  const totalNet = priced.reduce((sum, item) => sum + (item.netPrice ?? 0), 0);
  const margins = priced.filter((item) => item.margin !== null);
  return {
    analyzed: items.length,
    averagePercent: totalNet > 0 ? (totalCost / totalNet) * 100 : null,
    averageMargin: margins.length ? margins.reduce((sum, item) => sum + (item.margin ?? 0), 0) / margins.length : null,
    withWarnings: items.filter(hasWarning).length,
  };
}
