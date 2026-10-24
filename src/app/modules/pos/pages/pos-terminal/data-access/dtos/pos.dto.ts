// Tipos alineados con los DTOs documentados de /pos/* en el backend.

// POST /pos/check-staff-pin
export type CheckStaffPinDto = Readonly<{
  // El backend identifica al mesero por su code (UUID).
  userId: string;
  // PIN de exactamente 4 dígitos (el backend lo exige al asignarlo).
  serviceStaffPin: string;
}>;

export type CheckStaffPinResponseDto = Readonly<{ valid: boolean }>;

// GET /pos/service-staff?locationId=: meseros de la sucursal más los que no tienen sucursal.
export type PosServiceStaffParams = Readonly<{ locationId?: number }>;

export type PosServiceStaffDto = Readonly<{
  code: string;
  name: string;
  fatherLastName: string;
  email: string;
  hasPin: boolean;
  // null = mesero sin sucursal asignada (atiende en todas).
  branchId: number | null;
}>;

// POST /pos/details
export type PosDetailsRequestDto = Readonly<{
  locationId: number;
  transactionId?: number;
}>;

export type PosDetailsResponseDto = Readonly<{
  tables: ReadonlyArray<Readonly<{ id: number; name: string }>>;
  // Meseros activos del restaurante (name = nombre y apellido).
  waiters: ReadonlyArray<Readonly<{ code: string; name: string; hasPin: boolean }>>;
  waiterEnabled: boolean;
  tablesEnabled: boolean;
  resTableId: number | null;
  resWaiterId: string | null;
  isServiceStaffRequired: boolean;
  // Mostrar "IVA incluido" en la precuenta impresa (#70).
  showTaxOnPreBill?: boolean;
}>;

// Mesero con sesión abierta en el POS (solo front).
export type PosWaiter = Readonly<{ code: string; name: string }>;
