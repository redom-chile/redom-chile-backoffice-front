import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PLAN_FEATURE_LABELS, PlanFeatureCode, PublicPlansService } from 'src/app/core/services/entitlements';
import { SupportModeService } from 'src/app/core/services/support-mode';
import { IconComponent } from 'src/ui';

/** Sección bloqueada por el plan: se muestra con el llamado a mejorarlo en vez de ocultarla. */
@Component({
  selector: 'app-marketing-upsell-card',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass flex flex-col items-center gap-3 rounded-[1rem] px-5 py-10 text-center">
      <span class="bg-primary/10 text-primary inline-flex h-14 w-14 items-center justify-center rounded-full">
        <app-icon class="h-7 w-7" aria-hidden="true">workspace_premium</app-icon>
      </span>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ $featureName() }}</h2>
        <p class="text-muted-foreground mt-1 text-sm">{{ $planText() }}</p>
        <p class="text-muted-foreground mx-auto mt-2 max-w-md text-sm">{{ description() }}</p>
      </div>
      @if (!$supportMode()) {
      <a routerLink="/billing/plans" class="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:opacity-90">
        <app-icon class="h-4 w-4" aria-hidden="true">rocket_launch</app-icon>Ver planes
      </a>
      } @else {
      <p class="text-muted-foreground text-xs">El plan del negocio no incluye esta función.</p>
      }
    </section>
  `,
})
export class MarketingUpsellCardComponent {
  readonly #plans = inject(PublicPlansService);
  readonly $supportMode = inject(SupportModeService).$active;

  readonly feature = input.required<PlanFeatureCode>();
  readonly requiredPlans = input<readonly string[]>([]);
  readonly description = input('');

  readonly $featureName = computed(() => PLAN_FEATURE_LABELS[this.feature()]);
  readonly $planText = computed(() => {
    const code = this.requiredPlans()[0] ?? this.#plans.firstPlanWith([this.feature()])?.code;
    const name = this.#plans.planName(code);
    return name ? `Disponible desde el plan ${name}` : 'No está incluido en tu plan actual';
  });
}
