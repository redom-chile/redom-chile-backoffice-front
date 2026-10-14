import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RemoteResult, resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { CustomerFeedbackSummaryDto, CustomerOrdersService } from 'src/app/modules/public-menu/data-access';
import { formatOrderDate } from 'src/app/modules/public-menu/features/customer-order-card';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';

const LIMIT = 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RATINGS = [5, 4, 3, 2, 1] as const;

const pad = (value: number) => String(value).padStart(2, '0');
/** YYYY-MM-DD en la hora local. */
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
};

/** 'star' | 'star_half' | 'star_border' por cada una de las 5 estrellas. */
export function starIcons(value: number): string[] {
  return [1, 2, 3, 4, 5].map((star) => (value >= star - 0.25 ? 'star' : value >= star - 0.75 ? 'star_half' : 'star_border'));
}

type FeedbackItem = CustomerFeedbackSummaryDto['items'][number];

/** Encuestas de los pedidos de un local: promedio, distribución de notas y comentarios, con filtro de fechas. */
@Component({
  selector: 'app-customer-order-feedback',
  imports: [ButtonComponent, IconComponent, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div class="min-w-[9rem] flex-1 sm:flex-none">
        <label for="feedback-from" class="text-foreground mb-1 block text-sm font-medium">Desde</label>
        <input id="feedback-from" type="date" class="glass-input w-full rounded-lg px-3 py-2 text-sm" [max]="$to() || today" [value]="$from()" (change)="setFrom($event)" />
      </div>
      <div class="min-w-[9rem] flex-1 sm:flex-none">
        <label for="feedback-to" class="text-foreground mb-1 block text-sm font-medium">Hasta</label>
        <input id="feedback-to" type="date" class="glass-input w-full rounded-lg px-3 py-2 text-sm" [min]="$from()" [max]="today" [value]="$to()" (change)="setTo($event)" />
      </div>
      <div class="flex gap-1">
        @for (preset of presets; track preset.days) {
        <button
          type="button"
          class="glass-row h-9 rounded-full px-3 text-xs font-medium"
          [class]="$preset() === preset.days ? 'text-primary ring-primary ring-1' : 'text-muted-foreground hover:text-foreground'"
          (click)="applyPreset(preset.days)">
          {{ preset.label }}
        </button>
        }
      </div>
    </div>

    @if ($error()) {
    <div class="glass flex flex-col items-center gap-3 rounded-[1rem] px-5 py-10 text-center">
      <p class="text-muted-foreground text-sm">No se pudieron cargar las encuestas.</p>
      <app-button impact="light" size="small" type="button" (buttonClick)="feedback.reload()">Reintentar</app-button>
    </div>
    } @else if (!$summary()) {
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      @for (row of [1, 2]; track row) {
      <div class="glass space-y-3 rounded-[1rem] p-4">
        <app-skeleton size="sm" style="width: 40%" />
        <app-skeleton size="sm" style="width: 100%" />
        <app-skeleton size="sm" style="width: 80%" />
      </div>
      }
    </div>
    } @else {
    @let summary = $summary()!;
    <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" [class.opacity-60]="feedback.isLoading()">
      <section class="glass flex flex-col items-center justify-center gap-1 rounded-[1rem] p-5 text-center" aria-label="Promedio">
        @if (summary.average !== null) {
        <p class="text-foreground text-4xl font-semibold tabular-nums">{{ formatAverage(summary.average) }}</p>
        <div class="flex text-amber-500" [attr.aria-label]="formatAverage(summary.average) + ' de 5 estrellas'">
          @for (icon of $stars(); track $index) {
          <app-icon class="h-6 w-6" aria-hidden="true">{{ icon }}</app-icon>
          }
        </div>
        <p class="text-muted-foreground text-sm">{{ summary.count }} {{ summary.count === 1 ? 'encuesta' : 'encuestas' }}</p>
        } @else {
        <span class="bg-primary/10 text-primary inline-flex h-12 w-12 items-center justify-center rounded-full">
          <app-icon class="h-6 w-6" aria-hidden="true">star_border</app-icon>
        </span>
        <p class="text-foreground font-medium">Sin encuestas en estas fechas</p>
        <p class="text-muted-foreground max-w-xs text-sm">Cuando marques un pedido como servido, el cliente puede calificarlo desde la carta.</p>
        }
      </section>

      <section class="glass flex flex-col justify-center gap-2 rounded-[1rem] p-5" aria-label="Distribución de notas">
        @for (row of $distribution(); track row.rating) {
        <div class="flex items-center gap-3 text-sm">
          <span class="text-foreground inline-flex w-8 shrink-0 items-center gap-0.5 tabular-nums">
            {{ row.rating }}<app-icon class="h-4 w-4 text-amber-500" aria-hidden="true">star</app-icon>
          </span>
          <div class="bg-muted/60 h-2.5 flex-1 overflow-hidden rounded-full">
            <div class="h-full rounded-full bg-amber-500 transition-[width]" [style.width.%]="row.percent"></div>
          </div>
          <span class="text-muted-foreground w-10 shrink-0 text-right tabular-nums">{{ row.count }}</span>
        </div>
        }
      </section>
    </div>

    <h3 class="text-foreground mb-2 mt-6 font-semibold">Comentarios</h3>
    @if (!$comments().length) {
    <div class="glass rounded-[1rem] px-5 py-8 text-center">
      <p class="text-muted-foreground text-sm">No hay comentarios en estas fechas.</p>
    </div>
    } @else {
    <ul class="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
      @for (item of $comments(); track item.id) {
      <li class="glass flex flex-col gap-2 rounded-[1rem] p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="flex text-amber-500" [attr.aria-label]="item.rating + ' de 5 estrellas'">
            @for (icon of stars(item.rating); track $index) {
            <app-icon class="h-4 w-4" aria-hidden="true">{{ icon }}</app-icon>
            }
          </div>
          <span class="text-muted-foreground text-xs">{{ date(item.createdAt) }}</span>
        </div>
        @if (item.comment) {
        <p class="text-foreground whitespace-pre-line break-words text-sm">{{ item.comment }}</p>
        } @else {
        <p class="text-muted-foreground text-sm italic">Sin comentario</p>
        }
        <p class="text-muted-foreground text-xs">
          {{ item.tableName ?? 'Sin mesa' }}@if (item.customerName) { · <span class="text-foreground font-medium">{{ item.customerName }}</span>}
        </p>
      </li>
      }
    </ul>
    @if (summary.items.length >= limit) {
    <p class="text-muted-foreground mt-3 text-center text-xs">Se muestran las últimas {{ limit }} encuestas; acota las fechas para ver otras.</p>
    }
    }
    }
  `,
})
export class CustomerOrderFeedbackComponent {
  readonly #service = inject(CustomerOrdersService);

  readonly locationId = input.required<number>();

  readonly limit = LIMIT;
  readonly today = isoDay(new Date());
  readonly presets = [
    { days: 7, label: '7 días' },
    { days: 30, label: '30 días' },
    { days: 90, label: '90 días' },
  ] as const;
  readonly stars = starIcons;
  readonly date = formatOrderDate;

  readonly $from = signal(daysAgo(29));
  readonly $to = signal(this.today);
  readonly $preset = computed(() => {
    if (this.$to() !== this.today) return null;
    return this.presets.find((preset) => daysAgo(preset.days - 1) === this.$from())?.days ?? null;
  });

  readonly feedback = rxResource({
    params: () => ({ locationId: this.locationId(), from: this.$from() || undefined, to: this.$to() || undefined, limit: LIMIT }),
    stream: ({ params }) => this.#service.getFeedback(params).pipe(toRemoteResult()),
  });
  // Mantiene el último resumen mientras recarga.
  readonly $summary = linkedSignal<RemoteResult<CustomerFeedbackSummaryDto> | undefined, CustomerFeedbackSummaryDto | null>({
    source: () => this.feedback.value(),
    computation: (result, previous) => resultValue(result) ?? previous?.value ?? null,
  });
  readonly $error = computed(() => resultError(this.feedback.value()));
  readonly $stars = computed(() => starIcons(this.$summary()?.average ?? 0));
  readonly $distribution = computed(() => {
    const summary = this.$summary();
    const total = summary?.count ?? 0;
    return RATINGS.map((rating) => {
      const count = summary?.distribution[String(rating) as '1'] ?? 0;
      return { rating, count, percent: total ? Math.round((count / total) * 100) : 0 };
    });
  });
  /** Los más nuevos primero. */
  readonly $comments = computed<FeedbackItem[]>(() =>
    [...(this.$summary()?.items ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );

  setFrom(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$from.set(DAY.test(value) ? value : '');
    if (value && this.$to() && this.$to() < value) this.$to.set(value);
  }

  setTo(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.$to.set(DAY.test(value) ? value : '');
    if (value && this.$from() && this.$from() > value) this.$from.set(value);
  }

  applyPreset(days: number) {
    this.$from.set(daysAgo(days - 1));
    this.$to.set(this.today);
  }

  formatAverage(value: number) {
    return value.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}
