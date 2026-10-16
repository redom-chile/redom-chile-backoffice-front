export type BookingStatus = 'waiting' | 'booked' | 'completed' | 'cancelled';

// Ítem del listado (GET /bookings).
export type BookingDto = Readonly<{
  id: number;
  title: string;
  start: string;
  end: string;
  customerName: string;
  tableName: string | null;
  correspondentName: string | null;
  waiterName: string | null;
  locationName: string;
  status: BookingStatus;
  partySize: number;
  contactId: number;
  // Teléfono del cliente para llamarlo desde la agenda.
  customerMobile: string | null;
  tableId: number | null;
  // El listado todavía no lo trae; si llega, null = creada desde la carta pública.
  createdBy?: string | null;
}>;

// Detalle (GET /bookings/:id), necesario para editar: el listado no trae la nota.
export type BookingDetailDto = Readonly<{
  id: number;
  locationId: number;
  contactId: number;
  customerName: string;
  tableId: number | null;
  tableName: string | null;
  bookingStart: string;
  bookingEnd: string;
  bookingStatus: BookingStatus;
  bookingNote: string | null;
  locationName: string;
  partySize: number;
  // null: la pidió un cliente desde la carta pública (llega en espera).
  createdBy?: string | null;
}>;

export type BookingFiltersDto = Readonly<{
  startDate: string;
  endDate: string;
  locationId?: number;
  // Filtra en el backend por un estado; sin él vienen todas.
  status?: BookingStatus;
}>;

// Respuesta de POST /bookings y PUT /bookings/:id.
export type BookingIdDto = Readonly<{ id: number }>;

export type CreateBookingDto = Readonly<{
  contactId: number;
  locationId: number;
  bookingStart: string;
  bookingEnd?: string;
  tableId?: number;
  partySize?: number;
  bookingNote?: string;
}>;

export type UpdateBookingDto = Readonly<{
  id: number;
  bookingStatus?: BookingStatus;
  partySize?: number;
  bookingStart?: string;
  bookingEnd?: string;
  // null = dejar la reserva sin mesa.
  tableId?: number | null;
  bookingNote?: string;
}>;
