import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EntitlementsService,
  formatPlanUsage,
  LockableResource,
  PLAN_LIMIT_LABELS,
  PlanLimitCode,
} from 'src/app/core/services/entitlements';
import { IconComponent } from 'src/ui';

const RESOURCE_BY_LIMIT: Partial<Record<PlanLimitCode, LockableResource>> = {
  max_locations: 'locations',
  max_registers: 'registers',
  max_users: 'users',
};

/** "2 de 3 locales" junto al título. Sin plan conocido o superadmin no se muestra. */
@Component({
  selector: 'app-plan-usage',
  template: `
    @if ($text(); as text) {
      <span class="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap" [class]="$full() ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'">
        <app-icon class="h-4 w-4" aria-hidden="true">{{ $full() ? 'lock' : 'data_usage' }}</app-icon>{{ text }}
      </span>
    }
  `,
  imports: [IconComponent],
  host: { class: 'flex items-center' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanUsageComponent {
  readonly #entitlements = inject(EntitlementsService);
  readonly $limit = input.required<PlanLimitCode>({ alias: 'limit' });

  readonly $text = computed(() => {
    if (this.#entitlements.$unrestricted()) return null;
    const code = this.$limit();
    return formatPlanUsage(code, this.#entitlements.usageOf(code), this.#entitlements.limitOf(code));
  });
  readonly $full = computed(() => !this.#entitlements.canAdd(this.$limit()));
}

/** Etiqueta para un local, caja o usuario sobre el límite del plan. */
@Component({
  selector: 'app-plan-locked-badge',
  template: `
    <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400" title="Tu plan no cubre este recurso: puedes verlo, pero no operar con él.">
      <app-icon class="h-3.5 w-3.5" aria-hidden="true">lock</app-icon>Solo lectura (sobre el límite del plan)
    </span>
  `,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanLockedBadgeComponent {}

/** Aviso cuando hay recursos sobre el límite del plan (p. ej. tras bajar de plan). */
@Component({
  selector: 'app-plan-locked-notice',
  template: `
    @if ($max(); as max) {
      <div class="mb-4 flex flex-col gap-3 rounded-[1rem] border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
        <app-icon class="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true">lock</app-icon>
        <p class="text-foreground min-w-0 flex-1 text-sm">
          Tu plan permite {{ max }} {{ max === 1 ? $label().one : $label().many }}. Desactiva {{ $article() }} que no uses o mejora tu plan.
        </p>
        <a routerLink="/billing/plans" class="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
          Ver planes
          <app-icon class="h-4 w-4">arrow_forward</app-icon>
        </a>
      </div>
    }
  `,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanLockedNoticeComponent {
  readonly #entitlements = inject(EntitlementsService);
  readonly $limit = input.required<PlanLimitCode>({ alias: 'limit' });

  readonly $label = computed(() => PLAN_LIMIT_LABELS[this.$limit()]);
  // Locales y usuarios son masculinos; cajas, femenino.
  readonly $article = computed(() => (this.$limit() === 'max_registers' ? 'las' : 'los'));
  /** Límite del plan, solo si hay recursos bloqueados. */
  readonly $max = computed(() => {
    const resource = RESOURCE_BY_LIMIT[this.$limit()];
    const entitlements = this.#entitlements.$entitlements();
    if (!resource || !entitlements || this.#entitlements.$isSuperAdmin()) return null;
    if (!entitlements.lockedResources[resource].length) return null;
    return this.#entitlements.limitOf(this.$limit());
  });
}
