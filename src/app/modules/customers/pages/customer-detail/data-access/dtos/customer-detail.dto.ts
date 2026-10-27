export type CustomerRecentOrderDto = Readonly<{
  transactionId: number;
  invoiceNo: string;
  total: number;
  // ORDERED | FINAL | CANCELLED
  status: string;
  createdAt: string;
}>;

// Indicadores de todo el historial (pedidos no cancelados).
export type CustomerSummaryDto = Readonly<{
  visits: number;
  totalSpent: number;
  avgTicket: number;
  lastVisitAt: string | null;
}>;

export type CustomerDetailDto = Readonly<{
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  taxNumber: string | null;
  addressLine1: string | null;
  city: string | null;
  createdAt: string;
  // Etapa 10: se identificó con código en la carta.
  isVerified: boolean;
  verifiedAt: string | null;
  summary: CustomerSummaryDto;
  // Últimos 20 pedidos.
  recentOrders: CustomerRecentOrderDto[];
}>;

// El id va en la URL (PUT /contacts/:id), no en el body.
export type UpdateCustomerDto = Readonly<{
  name?: string;
  mobile?: string;
  email?: string;
  taxNumber?: string;
  addressLine1?: string;
  city?: string;
}>;
