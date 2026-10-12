import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { IconComponent } from 'src/ui';
import { ScheduleDto } from '../../data-access';
import { crossesMidnight, hhmm, WeekDay } from '../../ui';

export type ScheduleRange = Readonly<{ openTime: string; closeTime: string }>;

@Component({
  selector: 'app-day-schedule-row',
  standalone: true,
  imports: [IconComponent, NgTemplateOutlet],
  templateUrl: './day-schedule-row.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayScheduleRowComponent {
  readonly #access = inject(AccessService);
  readonly $canCreate = computed(() => this.#access.can(PERMISSIONS.SCHEDULES.CREATE_SCHEDULE));
  readonly $canUpdate = computed(() => this.#access.can(PERMISSIONS.SCHEDULES.UPDATE_SCHEDULE));
  readonly $canDelete = computed(() => this.#access.can(PERMISSIONS.SCHEDULES.DELETE_SCHEDULE));
  // Abrir/cerrar un día elimina tramos y crea el registro de cerrado.
  readonly $canToggleClosed = computed(() =>
    this.#access.can([PERMISSIONS.SCHEDULES.CREATE_SCHEDULE, PERMISSIONS.SCHEDULES.DELETE_SCHEDULE], 'all'),
  );

  readonly day = input.required<WeekDay>();
  readonly schedules = input.required<ScheduleDto[]>();
  readonly isToday = input(false);
  readonly busy = input(false);

  readonly addRange = output<ScheduleRange>();
  readonly updateRange = output<ScheduleRange & { id: number }>();
  readonly removeRange = output<ScheduleDto>();
  readonly setClosed = output<boolean>();

  readonly hhmm = hhmm;
  readonly crossesMidnight = crossesMidnight;

  readonly $closedRecord = computed(() => this.schedules().find((schedule) => schedule.isClosed) ?? null);
  readonly $ranges = computed(() =>
    this.schedules()
      .filter((schedule) => !schedule.isClosed)
      .sort((a, b) => a.openTime.localeCompare(b.openTime)),
  );

  // Edición en línea: null = sin editar, 'new' = tramo nuevo, número = id del tramo.
  readonly $editing = signal<'new' | number | null>(null);
  readonly $open = signal('12:00');
  readonly $close = signal('16:00');

  startAdd() {
    const last = this.$ranges().at(-1);
    // Sugerencia: el siguiente tramo empieza una hora después del último.
    this.$open.set(last ? this.shift(hhmm(last.closeTime), 60) : '12:00');
    this.$close.set(last ? this.shift(hhmm(last.closeTime), 240) : '16:00');
    this.$editing.set('new');
  }

  startEdit(range: ScheduleDto) {
    this.$open.set(hhmm(range.openTime));
    this.$close.set(hhmm(range.closeTime));
    this.$editing.set(range.id);
  }

  cancel() {
    this.$editing.set(null);
  }

  save() {
    const editing = this.$editing();
    const range = { openTime: this.$open(), closeTime: this.$close() };
    if (editing === 'new') this.addRange.emit(range);
    else if (editing !== null) this.updateRange.emit({ id: editing, ...range });
    this.$editing.set(null);
  }

  onTime(field: 'open' | 'close', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    (field === 'open' ? this.$open : this.$close).set(value);
  }

  private shift(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = (h * 60 + m + minutes) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
}
