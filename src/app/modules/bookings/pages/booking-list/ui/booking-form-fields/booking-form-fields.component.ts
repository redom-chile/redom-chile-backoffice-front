import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from 'src/ui';
import { TableDto } from 'src/app/modules/tables/pages/table-list/data-access';
import { BOOKING_STATUS_OPTIONS } from '../booking-status';
import { BookingForm, DURATIONS } from './booking-form';

@Component({
  selector: 'app-booking-form-fields',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './booking-form-fields.component.html',
})
export class BookingFormFieldsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly form = input.required<BookingForm>();
  readonly tables = input<TableDto[]>([]);
  readonly showStatus = input(false);
  readonly focusTable = input(false);

  private readonly tableSelect = viewChild<ElementRef<HTMLSelectElement>>('tableSelect');

  readonly durations = DURATIONS;
  readonly statusOptions = BOOKING_STATUS_OPTIONS;
  readonly inputClass = 'glass-input w-full rounded-md px-3 py-2';
  readonly $partySize = signal(2);

  // Mesas donde cabe el grupo (el backend también lo valida).
  readonly $availableTables = computed(() => this.tables().filter((table) => table.status !== 'blocked'));

  constructor() {
    afterNextRender(() => {
      if (this.focusTable()) this.tableSelect()?.nativeElement.focus();
    });
  }

  ngOnInit(): void {
    const partySize = this.form().controls.partySize;
    this.$partySize.set(partySize.value ?? 2);
    partySize.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => this.$partySize.set(value ?? 0));
  }

  changePartySize(delta: number) {
    const control = this.form().controls.partySize;
    control.setValue(Math.max(1, (control.value ?? 1) + delta));
  }

  durationLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
}
