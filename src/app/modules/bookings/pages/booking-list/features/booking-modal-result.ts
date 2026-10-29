import { BookingDetailDto } from '../data-access';

export type BookingModalResult = 'created' | 'updated' | 'cancelled';

export type CreateBookingModalData = Readonly<{ locationId: number; date: string }>;
// focus: campo que recibe el foco al abrir (acción rápida "Asignar mesa").
export type UpdateBookingModalData = Readonly<{ booking: BookingDetailDto; focus?: 'table' }>;
