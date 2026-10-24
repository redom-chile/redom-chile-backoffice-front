import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PlanFeatureCode, PlanUpsellService, PublicPlansService } from 'src/app/core/services/entitlements';
import { IconComponent } from 'src/ui';

/** Insignia "candado + plan" que abre el modal para mejorar el plan. */
@Component({
  selector: 'app-plan-lock-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="bg-primary/10 text-primary inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold hover:underline"
      [attr.aria-label]="'Disponible desde el plan ' + $plan() + '. Ver planes'"
      (click)="open()">
      <app-icon class="h-3 w-3" aria-hidden="true">lock</app-icon>{{ $plan() }}
    </button>
  `,
})
export class PlanLockBadgeComponent {
  readonly feature = input.required<PlanFeatureCode>();
  // Si los planes públicos no cargan se usa este nombre.
  readonly fallbackPlan = input('Emprende');
  readonly #plans = inject(PublicPlansService);
  readonly #upsell = inject(PlanUpsellService);
  protected readonly $plan = computed(
    () => this.#plans.planName(this.#plans.firstPlanWith([this.feature()])?.code) ?? this.fallbackPlan(),
  );

  open() {
    this.#upsell.open({ features: [this.feature()] });
  }
}
