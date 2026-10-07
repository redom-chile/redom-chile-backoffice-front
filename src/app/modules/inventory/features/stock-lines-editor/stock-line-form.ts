import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { CreateAdjustmentLineDto, CreatePurchaseLineDto, StockableItem } from '../../data-access';

/** required: compras (costo obligatorio) · optional: ajustes que suman · none: sin columna de costo. */
export type StockLineCostMode = 'required' | 'optional' | 'none';

/** positive: cantidad > 0 · signed: + suma / − resta (≠ 0). */
export type StockLineQuantityMode = 'positive' | 'signed';

/** none: sin lote · entry: toda línea admite lote/vencimiento · signed: solo las líneas que suman. */
export type StockLineLotMode = 'none' | 'entry' | 'signed';

export const MAX_LOT_NUMBER_LENGTH = 100;

export type StockLineForm = FormGroup<{
  item: FormControl<StockableItem>;
  quantity: FormControl<number | null>;
  /** null = unidad base (o producto sin unidad): no se envía unitId. */
  unitId: FormControl<number | null>;
  unitCost: FormControl<number | null>;
  /** Lote y vencimiento (YYYY-MM-DD): opcionales, solo en entradas. */
  lotNumber: FormControl<string>;
  expiryDate: FormControl<string>;
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

/** Lote y vencimiento recortados; los vacíos se omiten. */
function lineLot(line: StockLineForm): { lotNumber?: string; expiryDate?: string } {
  const lotNumber = (line.controls.lotNumber.value ?? '').trim();
  const expiryDate = (line.controls.expiryDate.value ?? '').trim();
  return {
    ...(lotNumber ? { lotNumber } : {}),
    ...(expiryDate ? { expiryDate } : {}),
  };
}

/** ¿La línea admite lote? En signed solo si suma stock. */
export function lotApplies(line: StockLineForm, lotMode: StockLineLotMode): boolean {
  if (lotMode === 'none') return false;
  return lotMode === 'entry' || Number(line.controls.quantity.value) > 0;
}

/** El lote es de las entradas: en compras siempre se envía si se ingresó. */
export function toPurchaseLines(lines: StockLinesArray): CreatePurchaseLineDto[] {
  return lines.controls.map((line) => {
    const { item, quantity, unitCost } = line.getRawValue();
    const unitId = lineUnitId(line);
    return {
      variationId: item.variationId,
      quantity: Number(quantity),
      ...(unitId ? { unitId } : {}),
      unitCost: Number(unitCost ?? 0),
      ...lineLot(line),
    };
  });
}

/**
 * El costo y el lote solo viajan en líneas que suman stock (el backend responde 400 si van en una salida).
 * lotMode 'none' (transferencias, mermas) nunca envía lote.
 */
export function toAdjustmentLines(
  lines: StockLinesArray,
  costMode: StockLineCostMode,
  lotMode: StockLineLotMode = 'none',
): CreateAdjustmentLineDto[] {
  return lines.controls.map((line) => {
    const { item, quantity, unitCost } = line.getRawValue();
    const unitId = lineUnitId(line);
    const sendCost = costMode !== 'none' && Number(quantity) > 0 && hasCost(unitCost);
    const sendLot = Number(quantity) > 0 && lotApplies(line, lotMode);
    return {
      variationId: item.variationId,
      quantity: Number(quantity),
      ...(unitId ? { unitId } : {}),
      ...(sendCost ? { unitCost } : {}),
      ...(sendLot ? lineLot(line) : {}),
    };
  });
}
