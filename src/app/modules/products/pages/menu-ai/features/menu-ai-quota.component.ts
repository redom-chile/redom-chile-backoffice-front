import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AiQuotaDto } from '../data-access';

/** Uso de la cuota mensual de descripciones con IA; sin límite no hay barra. */
@Component({
  selector: 'app-menu-ai-quota',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let q = quota();
    <div class="text-muted-foreground flex items-center justify-between gap-2 text-xs">
      <span>Descripciones con IA este mes</span>
      @if (q.limit === null) {
      <span class="text-foreground font-semibold tabular-nums">{{ q.used }} · Sin límite</span>
      } @else {
      <span class="text-foreground font-semibold tabular-nums">{{ q.used }} / {{ q.limit }}</span>
      }
    </div>
    @if (q.limit !== null) {
    <div
      class="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-label="Uso de la IA este mes"
      [attr.aria-valuenow]="q.used"
      aria-valuemin="0"
      [attr.aria-valuemax]="q.limit">
      <div class="h-full rounded-full" [class]="$percent() >= 100 ? 'bg-red-500' : 'bg-primary'" [style.width.%]="$percent()"></div>
    </div>
    }
  `,
})
export class MenuAiQuotaComponent {
  readonly quota = input.required<AiQuotaDto>();
  readonly $percent = computed(() => {
    const { used, limit } = this.quota();
    if (limit === null) return 0;
    return limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  });
}
