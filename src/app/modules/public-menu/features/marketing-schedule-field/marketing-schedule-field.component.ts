import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { DAY_SHORT } from 'src/app/modules/public-menu/data-access';
import { IconComponent } from 'src/ui';
import { crossesMidnight, EMPTY_SCHEDULE, formatDays, ScheduleFormValue, WEEK_ORDER } from './marketing-schedule';

/** Horario común de promociones y banners: fechas, días y horas (todo opcional). */
@Component({
  selector: 'app-marketing-schedule-field',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = value();
    <fieldset class="space-y-3 border-t border-[var(--border)] pt-4" [disabled]="disabled()">
      <legend class="text-foreground flex w-full items-center justify-between gap-2 pr-2 text-sm font-semibold">
        <span>Horario</span>
        @if ($hasAny()) {
        <button type="button" class="text-primary text-xs font-medium hover:underline" (click)="clear()">Quitar horario</button>
        }
      </legend>
      <p class="text-muted-foreground -mt-1 text-xs">Sin horario, vale siempre. Se usa la hora del negocio.</p>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label [for]="id + '-from'" class="mb-1 block text-xs font-medium">Desde el</label>
          <input [id]="id + '-from'" type="date" class="glass-input w-full rounded-md px-3 py-2 text-sm" [value]="v.startDate" (change)="patch({ startDate: $any($event.target).value })" />
        </div>
        <div>
          <label [for]="id + '-to'" class="mb-1 block text-xs font-medium">Hasta el (incluido)</label>
          <input [id]="id + '-to'" type="date" class="glass-input w-full rounded-md px-3 py-2 text-sm" [value]="v.endDate" [attr.min]="v.startDate || null" (change)="patch({ endDate: $any($event.target).value })" />
        </div>
      </div>

      <div>
        <span class="mb-1 block text-xs font-medium">Días</span>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Días de la semana">
          @for (day of week; track day) {
          @let on = v.days.includes(day);
          <button
            type="button"
            class="h-8 min-w-11 rounded-full border px-2 text-xs font-semibold transition-colors"
            [class]="on ? 'bg-primary text-primary-foreground border-transparent' : 'text-muted-foreground border-[var(--border)] hover:text-foreground'"
            [attr.aria-pressed]="on"
            (click)="toggleDay(day)">
            {{ dayNames[day] }}
          </button>
          }
        </div>
        <p class="text-muted-foreground mt-1 text-xs">{{ $daysLabel() }}</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label [for]="id + '-start'" class="mb-1 block text-xs font-medium">Hora de inicio</label>
          <input [id]="id + '-start'" type="time" class="glass-input w-full rounded-md px-3 py-2 text-sm" [value]="v.startTime" (change)="patch({ startTime: $any($event.target).value })" />
        </div>
        <div>
          <label [for]="id + '-end'" class="mb-1 block text-xs font-medium">Hora de término</label>
          <input [id]="id + '-end'" type="time" class="glass-input w-full rounded-md px-3 py-2 text-sm" [value]="v.endTime" (change)="patch({ endTime: $any($event.target).value })" />
        </div>
      </div>
      @if (error()) {
      <p class="text-destructive text-xs">{{ error() }}</p>
      } @else if ($crosses()) {
      <p class="text-muted-foreground flex items-start gap-1 text-xs">
        <app-icon class="h-4 w-4 shrink-0" aria-hidden="true">dark_mode</app-icon>
        Cruza la medianoche: termina a las {{ v.endTime }} del día siguiente.
      </p>
      }
    </fieldset>
  `,
})
export class MarketingScheduleFieldComponent {
  readonly value = model<ScheduleFormValue>(EMPTY_SCHEDULE);
  readonly error = input<string | null>(null);
  readonly disabled = input(false);

  protected readonly id = `schedule-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly week = WEEK_ORDER;
  protected readonly dayNames = DAY_SHORT;
  protected readonly $crosses = computed(() => crossesMidnight(this.value().startTime, this.value().endTime));
  protected readonly $daysLabel = computed(() => (this.value().days.length ? formatDays(this.value().days) : 'Sin días marcados: todos los días'));
  protected readonly $hasAny = computed(() => {
    const v = this.value();
    return !!(v.startDate || v.endDate || v.days.length || v.startTime || v.endTime);
  });

  readonly touched = signal(false);

  patch(changes: Partial<ScheduleFormValue>) {
    this.touched.set(true);
    this.value.update((current) => ({ ...current, ...changes }));
  }

  toggleDay(day: number) {
    const days = this.value().days;
    this.patch({ days: days.includes(day) ? days.filter((item) => item !== day) : [...days, day] });
  }

  clear() {
    this.patch(EMPTY_SCHEDULE);
  }
}
