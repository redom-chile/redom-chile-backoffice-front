import { BadgeConfig } from 'src/app/modules/orders/pages/order-list/ui';
import { BookingDetailDto, BookingDto, BookingStatus } from '../data-access';

export const BOOKING_STATUS: Record<BookingStatus, BadgeConfig> = {
  booked: { label: 'Confirmada', tone: 'blue' },
  waiting: { label: 'En espera', tone: 'amber' },
  completed: { label: 'Llegó', tone: 'green' },
  cancelled: { label: 'Cancelada', tone: 'red' },
};

export const MENU_BOOKING_LABEL = 'Desde la carta – pendiente de confirmar';

/**
 * Reserva pedida desde la carta pública que nadie ha confirmado: en espera y sin creador (createdBy null).
 * El listado no trae createdBy: se usa "en espera, sin encargado ni mesero" (las del backoffice se crean confirmadas).
 */
export function isPendingMenuBooking(booking: BookingDto | BookingDetailDto): boolean {
  if ('bookingStatus' in booking) return booking.bookingStatus === 'waiting' && booking.createdBy === null;
  if (booking.status !== 'waiting') return false;
  if (booking.createdBy !== undefined) return booking.createdBy === null;
  return !booking.correspondentName && !booking.waiterName;
}

export const BOOKING_STATUS_OPTIONS = (Object.keys(BOOKING_STATUS) as BookingStatus[]).map((value) => ({
  value,
  label: BOOKING_STATUS[value].label,
}));
