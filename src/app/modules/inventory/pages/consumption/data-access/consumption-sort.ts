import { ConsumptionItemDto } from '../../../data-access';

export type ConsumptionSortKey = 'varianceValue' | 'itemName' | 'theoreticalValue' | 'variance';
export type ConsumptionSort = Readonly<{ key: ConsumptionSortKey; direction: 'asc' | 'desc' }>;

export const DEFAULT_SORT: ConsumptionSort = { key: 'varianceValue', direction: 'desc' };

export const SORT_OPTIONS: ReadonlyArray<Readonly<{ key: ConsumptionSortKey; label: string }>> = [
  { key: 'varianceValue', label: 'Variación $' },
  { key: 'variance', label: 'Variación (cantidad)' },
  { key: 'theoreticalValue', label: 'Consumo teórico $' },
  { key: 'itemName', label: 'Nombre' },
];

/** Nueva columna: el nombre parte A→Z y los números de mayor a menor; la misma columna invierte el orden. */
export function toggleSort(current: ConsumptionSort, key: ConsumptionSortKey): ConsumptionSort {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: key === 'itemName' ? 'asc' : 'desc' };
}

export function sortItems(items: readonly ConsumptionItemDto[], sort: ConsumptionSort): ConsumptionItemDto[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const result =
      sort.key === 'itemName' ? a.itemName.localeCompare(b.itemName, 'es') : Number(a[sort.key] ?? 0) - Number(b[sort.key] ?? 0);
    return result * factor || a.itemName.localeCompare(b.itemName, 'es');
  });
}
