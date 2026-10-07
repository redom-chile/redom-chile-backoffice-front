/** GET /units */
export type UnitDto = Readonly<{
  id: number;
  businessId: number;
  actualName: string;
  shortName: string;
  allowDecimal: boolean;
  /** Si es subunidad: la unidad base. */
  baseUnitId: number | null;
  /** Cuántas unidades base equivale (string decimal, ej. "1000"). */
  baseUnitMultiplier: string | null;
}>;

/** POST /units y PUT /units/:id */
export type CreateUnitDto = Readonly<{
  actualName: string;
  shortName: string;
  allowDecimal: boolean;
  baseUnitId?: number | null;
  baseUnitMultiplier?: string | null;
}>;
