import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from 'src/ui';
import { StatusBadgeComponent } from 'src/app/modules/orders/pages/order-list/ui';
import { BookingDto, BookingStatus } from '../../data-access';
import { BOOKING_STATUS, createdByLabel, isMenuBooking, isPendingMenuBooking, MENU_BOOKING_LABEL, timeOf } from '../../ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

export type BookingStatusChange = Readonly<{ booking: BookingDto; status: BookingStatus }>;

@Component({
  selector: 'app-booking-agenda',
  standalone: true,
  imports: [IconComponent, StatusBadgeComponent, CheckPermissionDirective],
  templateUrl: './booking-agenda.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingAgendaComponent {
  protected readonly PERMISSIONS = PERMISSIONS;

  readonly bookings = input.required<BookingDto[]>();
  readonly busyIds = input<ReadonlySet<number>>(new Set());

  readonly edit = output<BookingDto>();
  readonly changeStatus = output<BookingStatusChange>();
  readonly assignTable = output<BookingDto>();

  readonly statusMap = BOOKING_STATUS;
  readonly timeOf = timeOf;
  readonly isMenuBooking = isMenuBooking;
  readonly isPendingMenuBooking = isPendingMenuBooking;
  readonly createdByLabel = createdByLabel;
  readonly menuBookingLabel = MENU_BOOKING_LABEL;

  // El filtro por estado lo aplica el backend; aquí solo se muestran las que llegan.
  // El resumen no cuenta las canceladas (no ocupan mesa).
  readonly $summary = computed(() => {
    const active = this.bookings().filter((booking) => booking.status !== 'cancelled');
    return {
      count: active.length,
      guests: active.reduce((sum, booking) => sum + booking.partySize, 0),
      cancelled: this.bookings().length - active.length,
    };
  });
}
