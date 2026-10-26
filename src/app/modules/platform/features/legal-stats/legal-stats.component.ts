import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LEGAL_AUDIENCE_LABELS, LegalStatsDto } from '../../data-access';

/** Aceptación de la versión vigente por audiencia (aceptaron / faltan / %). */
@Component({
  selector: 'app-legal-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let data = stats();
    @if (!data?.current) {
      <p class="text-muted-foreground text-sm">Sin versión vigente: todavía no hay aceptaciones que medir.</p>
    } @else if (!data!.audiences.length) {
      <p class="text-muted-foreground text-sm">Sin datos de aceptación.</p>
    } @else {
      <ul class="space-y-4">
        @for (row of data!.audiences; track row.audience) {
          <li>
            <div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span class="text-foreground font-medium">{{ labels[row.audience] }}</span>
              <span class="text-muted-foreground tabular-nums">
                {{ row.accepted }} de {{ row.total }} · faltan {{ row.pending }} ·
                <strong class="text-foreground">{{ row.percent }}%</strong>
              </span>
            </div>
            <div
              class="h-2.5 overflow-hidden rounded-full bg-[var(--muted)]"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-valuenow]="row.percent"
              [attr.aria-label]="'Aceptación de ' + labels[row.audience]">
              <div class="h-full rounded-full transition-all" [class]="tone(row.percent)" [style.width.%]="row.percent"></div>
            </div>
          </li>
        }
      </ul>
      <p class="text-muted-foreground mt-3 text-xs">Cuenta la aceptación de la versión vigente o de una posterior al último cambio material.</p>
    }
  `,
})
export class LegalStatsComponent {
  readonly stats = input<LegalStatsDto | null | undefined>(null);
  readonly labels = LEGAL_AUDIENCE_LABELS;

  tone(percent: number): string {
    if (percent >= 90) return 'bg-green-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  }
}
