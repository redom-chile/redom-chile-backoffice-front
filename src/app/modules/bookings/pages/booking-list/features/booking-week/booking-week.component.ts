import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BookingDto } from '../../data-access';
import { IconComponent } from 'src/ui';
import { addDays, createdByLabel, dateKeyOf, fromDateKey, isMenuBooking, isPendingMenuBooking, MENU_BOOKING_LABEL, timeOf, toDateKey } from '../../ui';

type WeekColumn = Readonly<{ key: string; weekday: string; day: number; isToday: boolean; bookings: BookingDto[] }>;

@Component({
  selector: 'app-booking-week',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './booking-week.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingWeekComponent {
  // Lunes de la semana (YYYY-MM-DD).
  readonly weekStart = input.required<string>();
  readonly bookings = input.required<BookingDto[]>();

  readonly selectDay = output<string>();
  readonly edit = output<BookingDto>();

  private readonly access = inject(AccessService);
  // Sin permiso de edición la reserva se sigue viendo, pero no abre el modal.
  protected readonly $canEdit = computed(() => this.access.can(PERMISSIONS.BOOKINGS.UPDATE_BOOKING));

  readonly timeOf = timeOf;
  readonly isMenuBooking = isMenuBooking;
  readonly isPendingMenuBooking = isPendingMenuBooking;
  readonly menuBookingLabel = MENU_BOOKING_LABEL;

  // Las canceladas llegan solo si el filtro de estado las incluye; se muestran tachadas.
  chipClass(booking: BookingDto): string {
    if (isPendingMenuBooking(booking)) return 'bg-amber-500/20 text-amber-900 ring-2 ring-amber-500 dark:text-amber-200';
    switch (booking.status) {
      case 'completed':
        return 'bg-green-500/15 text-green-800 dark:text-green-300';
      case 'waiting':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
      case 'cancelled':
        return 'bg-red-500/10 text-red-700 dark:text-red-300 line-through opacity-70';
      default:
        return 'bg-blue-500/15 text-blue-800 dark:text-blue-300';
    }
  }

  // En el chip no cabe el autor: va en el tooltip.
  chipTitle(booking: BookingDto): string | null {
    const parts = [isPendingMenuBooking(booking) ? 'Desde la carta – pendiente de confirmar' : isMenuBooking(booking) ? MENU_BOOKING_LABEL : createdByLabel(booking)];
    if (!this.$canEdit()) parts.push('No tienes permiso para editarla');
    return parts.filter(Boolean).join(' · ') || null;
  }

  readonly $columns = computed<WeekColumn[]>(() => {
    const today = toDateKey(new Date());
    const byDay = new Map<string, BookingDto[]>();
    for (const booking of this.bookings()) {
      const key = dateKeyOf(booking.start);
      byDay.set(key, [...(byDay.get(key) ?? []), booking]);
    }
    return Array.from({ length: 7 }, (_, index) => {
      const key = addDays(this.weekStart(), index);
      const date = fromDateKey(key);
      return {
        key,
        weekday: date.toLocaleDateString('es-CL', { weekday: 'short' }),
        day: date.getDate(),
        isToday: key === today,
        bookings: byDay.get(key) ?? [],
      };
    });
  });
}
