import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { CreateAdjustmentLineDto, CreatePurchaseLineDto, StockableItem } from '../../data-access';

/** required: compras (costo obligatorio) · optional: ajustes que suman · none: sin columna de costo. */
export type StockLineCostMode = 'required' | 'optional' | 'none';

/** positive: cantidad > 0 · signed: + suma / − resta (≠ 0). */
export type StockLineQuantityMode = 'positive' | 'signed';

export type StockLineForm = FormGroup<{
  item: FormControl<StockableItem>;
  quantity: FormControl<number | null>;
  /** null = unidad base (o producto sin unidad): no se envía unitId. */
  unitId: FormControl<number | null>;
  unitCost: FormControl<number | null>;
}>;

export type StockLinesArray = FormArray<StockLineForm>;

/** Texto extra bajo el ítem de una línea (ej. stock en el local de origen). warning lo destaca. */
export type StockLineHint = Readonly<{ text: string; tone?: 'muted' | 'warning' }>;
export type StockLineHintFn = (line: StockLineForm) => StockLineHint | null;

/** Máximo de líneas por documento (backend: 1..200). */
export const MAX_STOCK_LINES = 200;

export function createStockLinesArray(): StockLinesArray {
  return new FormArray<StockLineForm>([]);
}

function hasCost(value: number | null): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

// unitId solo si es una subunidad (distinta a la unidad del producto).
function lineUnitId(line: StockLineForm): number | undefined {
  const { item, unitId } = line.getRawValue();
  return unitId && unitId !== item.unitId ? unitId : undefined;
}

export function toPurchaseLines(lines: StockLinesArray): CreatePurchaseLineDto[] {
  return lines.controls.map((line) => {
    const { item, quantity, unitCost } = line.getRawValue();
    const unitId = lineUnitId(line);
    return {
      variationId: item.variationId,
      quantity: Number(quantity),
      ...(unitId ? { unitId } : {}),
      unitCost: Number(unitCost ?? 0),
    };
  });
}

/** El costo solo viaja en líneas que suman stock (el backend responde 400 si va en una salida). */
export function toAdjustmentLines(lines: StockLinesArray, costMode: StockLineCostMode): CreateAdjustmentLineDto[] {
  return lines.controls.map((line) => {
    const { item, quantity, unitCost } = line.getRawValue();
    const unitId = lineUnitId(line);
    const sendCost = costMode !== 'none' && Number(quantity) > 0 && hasCost(unitCost);
    return {
      variationId: item.variationId,
      quantity: Number(quantity),
      ...(unitId ? { unitId } : {}),
      ...(sendCost ? { unitCost } : {}),
    };
  });
}
