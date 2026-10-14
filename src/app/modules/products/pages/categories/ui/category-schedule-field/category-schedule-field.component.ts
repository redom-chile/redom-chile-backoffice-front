import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { IconComponent } from 'src/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CategorySchedule, SCHEDULE_DAYS, scheduleRangeError, ScheduleRange } from './category-schedule';

/** "Horario en la carta": todo el día o rangos por día (y, con varios locales, por local). */
@Component({
  selector: 'app-category-schedule-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-schedule-field.component.html',
})
export class CategoryScheduleFieldComponent {
  readonly schedule = model.required<CategorySchedule>();
  // Tras intentar guardar se muestran también los errores de horas vacías.
  readonly submitted = input(false);
  readonly note = input<string | null>(null);

  readonly days = SCHEDULE_DAYS;
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly $locations = computed(() => this.#locationsService.$locations() ?? []);
  readonly $multipleLocations = computed(() => this.$locations().length > 1);

  readonly inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:[color-scheme:dark]';

  setMode(mode: CategorySchedule['mode']) {
    this.schedule.update((schedule) => ({
      mode,
      // Al pasar a "Por horario" sin rangos se parte con uno.
      ranges: mode === 'ranges' && !schedule.ranges.length ? [newRange()] : schedule.ranges,
      touched: true,
    }));
  }

  addRange() {
    this.schedule.update((schedule) => {
      const last = schedule.ranges.at(-1);
      // Copia el último rango al día siguiente: lo normal es repetir el horario.
      const range = last ? { ...last, dayOfWeek: (last.dayOfWeek + 1) % 7 } : newRange();
      return { ...schedule, ranges: [...schedule.ranges, range], touched: true };
    });
  }

  removeRange(index: number) {
    this.schedule.update((schedule) => ({ ...schedule, ranges: schedule.ranges.filter((_, i) => i !== index), touched: true }));
  }

  updateRange(index: number, changes: Partial<ScheduleRange>) {
    this.schedule.update((schedule) => ({
      ...schedule,
      ranges: schedule.ranges.map((range, i) => (i === index ? { ...range, ...changes } : range)),
      touched: true,
    }));
  }

  onLocationChange(index: number, value: string) {
    this.updateRange(index, { locationId: value ? Number(value) : null });
  }

  rangeError(range: ScheduleRange): string | null {
    const error = scheduleRangeError(range);
    // Las horas vacías solo se marcan al intentar guardar; inicio = término, siempre.
    if (!error || (!this.submitted() && (!range.startTime || !range.endTime))) return null;
    return error;
  }
}

function newRange(): ScheduleRange {
  return { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', locationId: null };
}
