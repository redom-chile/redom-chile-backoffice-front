import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BookingDto } from '../../data-access';
import { addDays, dateKeyOf, fromDateKey, timeOf, toDateKey } from '../../ui';

type WeekColumn = Readonly<{ key: string; weekday: string; day: number; isToday: boolean; bookings: BookingDto[] }>;

@Component({
  selector: 'app-booking-week',
  standalone: true,
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

  // Las canceladas llegan solo si el filtro de estado las incluye; se muestran tachadas.
  chipClass(booking: BookingDto): string {
    switch (booking.status) {
      case 'completed':
        return 'bg-green-500/15 text-green-800';
      case 'waiting':
        return 'bg-amber-500/15 text-amber-800';
      case 'cancelled':
        return 'bg-red-500/10 text-red-700 line-through opacity-70';
      default:
        return 'bg-blue-500/15 text-blue-800';
    }
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
