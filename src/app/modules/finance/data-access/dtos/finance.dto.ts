import { PaymentMethod } from 'src/app/modules/payments/pages/payment-list/data-access/dtos/payment.dto';

export type { PaymentMethod };
export type ExpenseStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type ExpenseDocumentType = 'invoice' | 'receipt' | 'none';
export type RecurringFrequency = 'monthly' | 'weekly';
export type PayableType = 'expense' | 'purchase';

// ---------- Categorías: /expenses/categories ----------
export type ExpenseCategoryDto = Readonly<{ id: number; name: string; isActive: boolean }>;
export type CreateExpenseCategoryDto = Readonly<{ name: string }>;
export type UpdateExpenseCategoryDto = Readonly<{ name?: string; isActive?: boolean }>;

// ---------- Pagos de cuentas por pagar ----------
/** Pago de un gasto o compra; los anulados vienen con cancelled = true. */
export type PayablePaymentDto = Readonly<{
  id: number;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  note: string | null;
  // Turno de caja del que salió (efectivo con la caja activa).
  cashSessionId: number | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  cancelled: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
}>;

/** "Pagado ahora": paga el total al guardar (efectivo con la caja activa sale del turno). */
export type PayNowDto = Readonly<{ method: PaymentMethod; cashRegisterId?: number; reference?: string }>;

// ---------- Gastos: /expenses ----------
export type ExpenseFiltersDto = Readonly<{
  locationId?: number;
  categoryId?: number;
  supplierId?: number;
  status?: ExpenseStatus;
  // Fecha del gasto, YYYY-MM-DD.
  dateFrom?: string;
  dateTo?: string;
  // Descripción o número de documento.
  search?: string;
  page?: number;
  // Máx. 100 (el backend no acepta `limit`).
  perPage?: number;
}>;

export type ExpenseListItemDto = Readonly<{
  id: number;
  expenseDate: string;
  description: string;
  categoryId: number;
  categoryName: string;
  locationId: number;
  locationName: string;
  supplierId: number | null;
  supplierName: string | null;
  // Con IVA.
  amount: number;
  vatAmount: number;
  paidAmount: number;
  // 0 si está anulado.
  balance: number;
  status: ExpenseStatus;
  dueDate: string;
  // Pendiente o parcial con vencimiento antes de hoy.
  overdue: boolean;
  documentType: ExpenseDocumentType;
  documentNo: string | null;
  hasDocument: boolean;
  recurringExpenseId: number | null;
}>;

export type ExpenseDto = Readonly<{
  id: number;
  locationId: number;
  locationName: string;
  categoryId: number;
  categoryName: string;
  supplierId: number | null;
  supplierName: string | null;
  description: string;
  expenseDate: string;
  amount: number;
  vatAmount: number;
  // amount − vatAmount.
  netAmount: number;
  documentType: ExpenseDocumentType;
  documentNo: string | null;
  documentFileId: string | null;
  // URL temporal para ver o descargar.
  documentUrl: string | null;
  dueDate: string;
  paidAmount: number;
  balance: number;
  status: ExpenseStatus;
  overdue: boolean;
  recurringExpenseId: number | null;
  period: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  payments: PayablePaymentDto[];
}>;

export type SaveExpenseDto = Readonly<{
  locationId: number;
  categoryId: number;
  supplierId?: number | null;
  // Máx. 255.
  description: string;
  // Con IVA, > 0.
  amount: number;
  // ≤ amount (con factura, sugerido round(amount × 19 / 119)).
  vatAmount?: number;
  documentType?: ExpenseDocumentType;
  documentNo?: string | null;
  // Subido antes a la carpeta expense_documents; null quita el archivo (al editar).
  documentFileId?: string | null;
  // Por defecto hoy.
  expenseDate?: string;
  // Por defecto: fecha + condiciones de pago del proveedor (sin ellas, el mismo día).
  dueDate?: string;
  notes?: string | null;
}>;

/** Crear acepta además "Pagado ahora"; editar no (ni puede bajar el monto de lo pagado). */
export type CreateExpenseDto = SaveExpenseDto & Readonly<{ payment?: PayNowDto }>;
export type UpdateExpenseDto = Partial<SaveExpenseDto>;

// ---------- Recurrentes: /expenses/recurring ----------
export type RecurringExpenseDto = Readonly<{
  id: number;
  locationId: number;
  locationName: string;
  categoryId: number;
  categoryName: string;
  supplierId: number | null;
  supplierName: string | null;
  description: string;
  amount: number;
  vatAmount: number;
  documentType: ExpenseDocumentType;
  frequency: RecurringFrequency;
  // monthly 1..31 (último día si el mes es más corto); weekly 1 (lunes) .. 7 (domingo).
  dayOfPeriod: number;
  startDate: string;
  endDate: string | null;
  // Días para pagarlo desde que ocurre.
  dueDays: number;
  isActive: boolean;
  lastPeriod: string | null;
  nextDate: string | null;
}>;

export type SaveRecurringExpenseDto = Readonly<{
  locationId: number;
  categoryId: number;
  supplierId?: number | null;
  description: string;
  amount: number;
  vatAmount?: number;
  documentType?: ExpenseDocumentType;
  frequency: RecurringFrequency;
  dayOfPeriod: number;
  startDate?: string;
  endDate?: string | null;
  dueDays?: number;
}>;

export type UpdateRecurringExpenseDto = Partial<SaveRecurringExpenseDto> & Readonly<{ isActive?: boolean }>;

// ---------- Cuentas por pagar: /payables ----------
export type PayableFiltersDto = Readonly<{
  type?: PayableType;
  locationId?: number;
  supplierId?: number;
  // Vence hasta esta fecha (YYYY-MM-DD).
  dueBefore?: string;
  overdueOnly?: boolean;
}>;

export type PayableItemDto = Readonly<{
  type: PayableType;
  // Gasto o documento de compra.
  id: number;
  locationId: number;
  locationName: string;
  supplierId: number | null;
  supplierName: string | null;
  description: string;
  categoryName: string | null;
  documentNo: string | null;
  date: string;
  dueDate: string;
  // Con IVA.
  total: number;
  paidAmount: number;
  balance: number;
  status: 'pending' | 'partial';
  overdue: boolean;
  // Negativo si está vencida.
  daysToDue: number;
}>;

export type PayablesTotalsDto = Readonly<{
  count: number;
  balance: number;
  overdueCount: number;
  overdueBalance: number;
  dueNext7DaysBalance: number;
}>;

/** Solo deudas abiertas, la que vence primero arriba (sin paginar). */
export type PayablesDto = Readonly<{ items: PayableItemDto[]; totals: PayablesTotalsDto }>;

export type CreatePayablePaymentDto = Readonly<{
  method: PaymentMethod;
  // Solo efectivo con la caja activa.
  cashRegisterId?: number;
  reference?: string;
  // Por defecto, el saldo completo.
  amount?: number;
  // ISO; por defecto ahora.
  paidAt?: string;
  note?: string;
}>;

export type PayablePaymentResultDto = Readonly<{
  id: number;
  amount: number;
  paidAmount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid';
  cashSessionId: number | null;
}>;

export type CancelPayablePaymentResultDto = Readonly<{
  paidAmount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid';
}>;
