import { BadgeConfig } from 'src/app/modules/orders/pages/order-list/ui';
import { BookingDetailDto, BookingDto, BookingStatus } from '../data-access';

export const BOOKING_STATUS: Record<BookingStatus, BadgeConfig> = {
  booked: { label: 'Confirmada', tone: 'blue' },
  waiting: { label: 'En espera', tone: 'amber' },
  completed: { label: 'Llegó', tone: 'green' },
  cancelled: { label: 'Cancelada', tone: 'red' },
};

export const MENU_BOOKING_LABEL = 'Desde la carta';

export function isMenuBooking(booking: BookingDto | BookingDetailDto): boolean {
  return booking.source === 'public_menu';
}

// Pedida desde la carta y todavía sin confirmar (llega en espera).
export function isPendingMenuBooking(booking: BookingDto | BookingDetailDto): boolean {
  const status = 'bookingStatus' in booking ? booking.bookingStatus : booking.status;
  return isMenuBooking(booking) && status === 'waiting';
}

// "Creada por …" solo para las del equipo con autor conocido.
export function createdByLabel(booking: BookingDto | BookingDetailDto): string | null {
  return !isMenuBooking(booking) && booking.createdByName ? `Creada por ${booking.createdByName}` : null;
}

export const BOOKING_STATUS_OPTIONS = (Object.keys(BOOKING_STATUS) as BookingStatus[]).map((value) => ({
  value,
  label: BOOKING_STATUS[value].label,
}));
