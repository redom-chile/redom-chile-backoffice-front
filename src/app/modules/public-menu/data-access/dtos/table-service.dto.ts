/** Carta pública, etapa 4: servicio en la mesa, reservas y encuesta. Backend: libs/restaurant/public-menu/src/lib/table-service-dto.ts. */

export type TableRequestType = 'call_waiter' | 'request_bill' | 'other';

export type TableRequestDto = Readonly<{
  id: number;
  type: TableRequestType;
  note: string | null;
  status: 'open' | 'attended';
  createdAt: string;
  attendedAt: string | null;
}>;

/** Vista del personal. */
export type StaffTableRequestDto = TableRequestDto &
  Readonly<{ locationId: number; table: Readonly<{ id: number; name: string }>; attendedBy: string | null }>;

export type TableBillDto = Readonly<{
  table: Readonly<{ id: number; name: string }>;
  /** false: la mesa no tiene consumos todavía. */
  open: boolean;
  invoiceNo: string | null;
  lines: ReadonlyArray<{ name: string; quantity: number; total: number; modifiers: string[]; packItems: string[] }>;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  suggestedTipPercent: number | null;
  suggestedTip: number | null;
}>;

/** start ISO: de 30 minutos a 60 días después. phone: 8 a 15 dígitos. */
export type CreatePublicBookingDto = Readonly<{
  businessSlug: string;
  locationSlug: string;
  name: string;
  phone: string;
  partySize: number;
  start: string;
  note?: string;
}>;

export type PublicBookingDto = Readonly<{ id: number; status: 'waiting'; locationName: string; start: string; end: string; partySize: number }>;

export type OrderFeedbackDto = Readonly<{ rating: number; comment: string | null }>;

/** googleReviewUrl: solo con nota 4 o 5 y si el local lo configuró. */
export type OrderFeedbackResultDto = OrderFeedbackDto & Readonly<{ googleReviewUrl: string | null }>;

export type CustomerFeedbackSummaryDto = Readonly<{
  count: number;
  /** 1 decimal; null sin notas. */
  average: number | null;
  distribution: Readonly<Record<'1' | '2' | '3' | '4' | '5', number>>;
  items: ReadonlyArray<{
    id: number;
    locationId: number;
    customerOrderId: string;
    rating: number;
    comment: string | null;
    tableName: string | null;
    customerName: string | null;
    createdAt: string;
  }>;
}>;
