import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import {
  ButtonComponent,
  ConfirmModalComponent,
  ConfirmModalData,
  EmptyStateComponent,
  HeaderDashboardComponent,
  IconComponent,
  ToastService,
} from 'src/ui';
import { BusinessLocationSelector } from 'src/app/modules/sectors/pages/sector-list/ui';
import { BookingDto, BookingService, BookingStatus, getBookingErrorMessage, GetBookingsService } from './data-access';
import {
  BookingAgendaComponent,
  BookingModalResult,
  BookingStatusChange,
  BookingWeekComponent,
  CreateBookingModalComponent,
  CreateBookingModalData,
  UpdateBookingModalComponent,
  UpdateBookingModalData,
} from './features';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { addDays, BOOKING_STATUS, BOOKING_STATUS_OPTIONS, longDate, startOfWeek, toDateKey, toIsoRange } from './ui';

type BookingView = 'day' | 'week';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toQuery(params: ParamMap): { date: string; view: BookingView; status: BookingStatus | null } {
  const date = params.get('date');
  const status = params.get('status') as BookingStatus | null;
  return {
    date: date && DATE_PATTERN.test(date) ? date : toDateKey(new Date()),
    view: params.get('view') === 'week' ? 'week' : 'day',
    // El estado se filtra en el backend (?status=); sin él vienen todas, canceladas incluidas.
    status: status && status in BOOKING_STATUS ? status : null,
  };
}

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    BusinessLocationSelector,
    BookingAgendaComponent,
    BookingWeekComponent,
    CheckPermissionDirective,
  ],
  templateUrl: './booking-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly bookingsService = inject(GetBookingsService);
  private readonly bookingService = inject(BookingService);

  protected readonly PERMISSIONS = PERMISSIONS;

  readonly $query = toSignal(this.route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.route.snapshot.queryParamMap),
  });
  readonly $locationId = signal<number | null>(null);
  readonly $bookings = computed(() => this.bookingsService.$bookings() ?? []);
  readonly $isLoading = computed(() => this.bookingsService.$isLoading() ?? false);
  readonly $hasError = computed(() => this.bookingsService.$error() !== undefined);
  readonly $busyIds = signal<ReadonlySet<number>>(new Set());
  readonly statusOptions = BOOKING_STATUS_OPTIONS;

  readonly $weekStart = computed(() => startOfWeek(this.$query().date));
  readonly $title = computed(() => {
    const { date, view } = this.$query();
    if (view === 'day') return longDate(date);
    const start = this.$weekStart();
    return `Semana del ${longDate(start).toLowerCase()} al ${longDate(addDays(start, 6)).toLowerCase()}`;
  });
  readonly $isToday = computed(() => this.$query().date === toDateKey(new Date()));

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  handleLocationChange(locationId: number) {
    this.$locationId.set(locationId);
    this.load();
  }

  setView(view: BookingView) {
    this.navigate({ view: view === 'day' ? null : view });
  }

  goToday() {
    this.navigate({ date: null });
  }

  move(step: number) {
    const { date, view } = this.$query();
    this.navigate({ date: addDays(date, view === 'week' ? step * 7 : step) });
  }

  pickDate(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (DATE_PATTERN.test(value)) this.navigate({ date: value });
  }

  pickStatus(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.navigate({ status: value || null });
  }

  openDay(date: string) {
    this.navigate({ date, view: null });
  }

  handleCreate() {
    const locationId = this.$locationId();
    if (!locationId) return;
    this.dialog
      .open<CreateBookingModalComponent, CreateBookingModalData, BookingModalResult>(CreateBookingModalComponent, {
        width: '600px',
        maxWidth: '95vw',
        disableClose: true,
        data: { locationId, date: this.$query().date },
      })
      .afterClosed()
      .subscribe((result) => this.handleResult(result));
  }

  // El listado ya trae contactId y tableId, pero no la nota: el detalle sigue siendo necesario para editar.
  handleEdit(booking: BookingDto) {
    this.setBusy(booking.id, true);
    this.bookingService.findById(booking.id).subscribe({
      next: (detail) => {
        this.setBusy(booking.id, false);
        this.dialog
          .open<UpdateBookingModalComponent, UpdateBookingModalData, BookingModalResult>(UpdateBookingModalComponent, {
            width: '600px',
            maxWidth: '95vw',
            disableClose: true,
            data: { booking: detail },
          })
          .afterClosed()
          .subscribe((result) => this.handleResult(result));
      },
      error: (error: HttpErrorResponse) => {
        this.setBusy(booking.id, false);
        this.toast.show(getBookingErrorMessage(error), 'error');
      },
    });
  }

  handleStatus({ booking, status }: BookingStatusChange) {
    const apply = () => {
      this.setBusy(booking.id, true);
      this.bookingService.update({ id: booking.id, bookingStatus: status }).subscribe({
        next: () => {
          this.setBusy(booking.id, false);
          this.toast.show(`${booking.customerName}: ${BOOKING_STATUS[status].label.toLowerCase()}`, 'success');
          this.bookingsService.retry();
        },
        error: (error: HttpErrorResponse) => {
          this.setBusy(booking.id, false);
          this.toast.show(getBookingErrorMessage(error), 'error');
        },
      });
    };
    if (status !== 'cancelled') {
      apply();
      return;
    }
    this.dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Cancelar reserva',
          message: `¿Cancelar la reserva de ${booking.customerName} (${booking.partySize} personas)? Quedará en el historial y la mesa se libera.`,
          confirmText: 'Cancelar reserva',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) apply();
      });
  }

  handleRetry() {
    this.bookingsService.retry();
  }

  private handleResult(result: BookingModalResult | undefined) {
    if (result === 'created') this.toast.show('Reserva creada', 'success');
    else if (result === 'updated') this.toast.show('Reserva actualizada', 'success');
    else return;
    this.bookingsService.retry();
  }

  private load() {
    const locationId = this.$locationId();
    if (!locationId) return;
    const { date, view, status } = this.$query();
    const range = view === 'week' ? toIsoRange(startOfWeek(date), 7) : toIsoRange(date, 1);
    this.bookingsService.load({ ...range, locationId, ...(status && { status }) });
  }

  private navigate(queryParams: Record<string, string | null>) {
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private setBusy(id: number, busy: boolean) {
    this.$busyIds.update((ids) => {
      const next = new Set(ids);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
