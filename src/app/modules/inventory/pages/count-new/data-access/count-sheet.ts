import { EMPTY, expand, Observable, reduce } from 'rxjs';
import { InventoryService, StockItemDto, UnitDto, unitMultiplier, unitsForProduct } from '../../../data-access';
import { productLabel, variationLabel } from '../../../shared';

// GET /inventory/stock acepta hasta 100 por página.
const SHEET_PER_PAGE = 100;
// Tope de seguridad de páginas (10.000 ítems).
const MAX_PAGES = 100;
export const MAX_COUNT_LINES = 500;

export type CountKindFilter = 'all' | 'ingredient' | 'product';

/** Una fila de la planilla de conteo (un ítem con stock propio del local). */
export type CountSheetItem = Readonly<{
  variationId: number;
  productName: string;
  variationName: string | null;
  label: string;
  sku: string;
  isIngredient: boolean;
  baseUnitId: number | null;
  baseUnitName: string | null;
  // Unidad base + subunidades; vacío si el producto no tiene unidad.
  units: readonly UnitDto[];
  systemQuantity: number;
}>;

export type CountQuantityError = 'format' | 'integer';

/** Cantidad contada: null = sin contar; error si no es un número ≥ 0 con hasta 4 decimales. */
export type ParsedCount =
  | Readonly<{ state: 'empty' }>
  | Readonly<{ state: 'invalid'; error: CountQuantityError }>
  | Readonly<{ state: 'valid'; quantity: number }>;

const QUANTITY_PATTERN = /^\d+(\.\d{1,4})?$/;

/** Carga la planilla completa del local recorriendo todas las páginas de GET /inventory/stock. */
export function loadCountSheet(inventory: InventoryService, locationId: number): Observable<StockItemDto[]> {
  const fetchPage = (page: number) => inventory.getStock({ locationId, page, perPage: SHEET_PER_PAGE });
  return fetchPage(1).pipe(
    expand((response, index) => {
      const next = index + 2;
      return next <= Math.min(Number(response.pagination.totalPages) || 1, MAX_PAGES) ? fetchPage(next) : EMPTY;
    }),
    reduce((items, response) => items.concat(response.data), [] as StockItemDto[]),
  );
}

/** Arma las filas; si un ítem se movió de página mientras se cargaba, se queda la primera aparición. */
export function toCountSheet(items: readonly StockItemDto[], units: readonly UnitDto[]): CountSheetItem[] {
  const seen = new Set<number>();
  const rows: CountSheetItem[] = [];
  for (const item of items) {
    if (seen.has(item.variationId)) continue;
    seen.add(item.variationId);
    rows.push({
      variationId: item.variationId,
      productName: item.productName,
      variationName: variationLabel(item.variationName),
      label: productLabel(item.productName, item.variationName),
      sku: item.sku,
      isIngredient: item.productType === 'ingredient',
      baseUnitId: item.unitId,
      baseUnitName: item.unitName,
      units: unitsForProduct(units, item.unitId),
      systemQuantity: Number(item.qtyAvailable ?? 0),
    });
  }
  return rows;
}

/** Acepta coma o punto decimal. */
export function parseCount(raw: string | undefined, unit: UnitDto | null): ParsedCount {
  const text = (raw ?? '').trim().replace(',', '.');
  if (!text) return { state: 'empty' };
  if (!QUANTITY_PATTERN.test(text)) return { state: 'invalid', error: 'format' };
  const quantity = Number(text);
  if (unit && !unit.allowDecimal && !Number.isInteger(quantity)) return { state: 'invalid', error: 'integer' };
  return { state: 'valid', quantity };
}

/** Unidad elegida en la fila (por defecto la base). */
export function selectedUnit(item: CountSheetItem, unitId: number | undefined): UnitDto | null {
  const id = unitId ?? item.baseUnitId;
  return item.units.find((unit) => unit.id === id) ?? item.units.find((unit) => unit.id === item.baseUnitId) ?? null;
}

/** Cantidad contada en la unidad base (para la diferencia en vivo). */
export function toBaseQuantity(quantity: number, item: CountSheetItem, unit: UnitDto | null): number {
  const multiplier = unit && unit.id !== item.baseUnitId ? unitMultiplier(unit) : 1;
  return roundQuantity(quantity * multiplier);
}

export function roundQuantity(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
