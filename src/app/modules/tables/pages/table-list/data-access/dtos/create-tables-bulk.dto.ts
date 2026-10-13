export type CreateTablesBulkDto = Readonly<{
  sectorId: number;
  // 1 a 100
  count: number;
  // Por defecto el local del sector (obligatorio si el sector no tiene)
  locationId?: number;
  // Por defecto el nombre del sector ("Salón" → "Salón 1", "Salón 2"…)
  prefix?: string;
  capacity?: number;
}>;

export type CreatedTableDto = Readonly<{ id: number; name: string; qrCode: string }>;

export type CreateTablesBulkResultDto = Readonly<{
  tables: CreatedTableDto[];
  names: string[];
}>;
