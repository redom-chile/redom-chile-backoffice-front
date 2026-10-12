import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PlatformPlanDto } from '../../data-access';

const BADGE = 'rounded-full px-2 py-0.5 text-xs font-medium';

/** Badges del plan: estado, público o a medida, destacado y free. */
@Component({
  selector: 'app-plan-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-center gap-1.5' },
  template: `
    @let plan = $plan();
    <span [class]="badge + ' ' + (plan.isActive ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-[var(--muted)] text-muted-foreground')">
      {{ plan.isActive ? 'Activo' : 'Inactivo' }}
    </span>
    <span [class]="badge + ' ' + (plan.isPublic ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'bg-violet-500/15 text-violet-700 dark:text-violet-300')">
      {{ plan.isPublic ? 'Público' : 'A medida' }}
    </span>
    @if (plan.isHighlighted) {
    <span [class]="badge + ' bg-amber-500/15 text-amber-700 dark:text-amber-300'">Destacado</span>
    }
    @if (plan.isFree) {
    <span [class]="badge + ' bg-[var(--muted)] text-foreground'">Free</span>
    }
  `,
})
export class PlanBadgesComponent {
  readonly $plan = input.required<PlatformPlanDto>({ alias: 'plan' });
  protected readonly badge = BADGE;
}
