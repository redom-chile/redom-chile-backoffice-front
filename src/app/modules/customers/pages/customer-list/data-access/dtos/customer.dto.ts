// Ítem del listado (GET /customers, con o sin búsqueda).
export type CustomerListItemDto = Readonly<{
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  // Etapa 10: se identificó con código en la carta.
  isVerified: boolean;
  verifiedAt: string | null;
}>;

export type CustomerFiltersDto = Readonly<{
  page: number;
  perPage: number;
  q?: string;
}>;
