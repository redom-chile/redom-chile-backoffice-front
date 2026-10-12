// printing: reservada por un equipo (POST /print-jobs/pending/claim) mientras la imprime.
export type PrintJobStatus = 'pending' | 'printing' | 'printed' | 'failed';

// Todo lo necesario para imprimir una comanda (POST /print-jobs/pending/claim).
// Sin transactionId es un ticket de prueba pedido desde Impresoras (POST /print-jobs/test).
export type PendingPrintJobDto = Readonly<{
  id: number;
  printerId: number;
  stationId: number | null;
  stationName: string | null;
  attempts: number;
  createdAt: string;
  transactionId: number | null;
  invoiceNo: string | null;
  tableName: string | null;
  waiterName: string | null;
  staffNote: string | null;
  items: ReadonlyArray<{
    productName: string | null;
    variationName: string | null;
    quantity: number | null;
    notes: string | null;
    // Modificadores ya formateados, se imprimen bajo el producto.
    modifiers?: string[];
  }>;
}>;

export type UpdatePrintJobStatusDto = Readonly<{
  id: number;
  status: PrintJobStatus;
  errorMessage?: string;
}>;
