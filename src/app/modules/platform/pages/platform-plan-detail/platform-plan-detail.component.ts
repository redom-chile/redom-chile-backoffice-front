import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { getPlatformErrorMessage, PlatformPlanDto, PlatformService } from '../../data-access';
import { PlanDataFormComponent } from '../../features/plan-data-form';
import { PlanFeaturesFormComponent } from '../../features/plan-features-form';
import { PlanLimitsFormComponent } from '../../features/plan-limits-form';
import { PlanPricesComponent } from '../../features/plan-prices';
import { PlanBadgesComponent, subscriptionsLabel } from '../../features/plan-shared';

type PlanTab = 'data' | 'features' | 'limits' | 'prices';

const TABS: ReadonlyArray<Readonly<{ id: PlanTab; label: string; icon: string }>> = [
  { id: 'data', label: 'Datos', icon: 'edit_note' },
  { id: 'features', label: 'Funciones', icon: 'checklist' },
  { id: 'limits', label: 'Límites', icon: 'speed' },
  { id: 'prices', label: 'Precios', icon: 'payments' },
];

/** Detalle de un plan con pestañas sincronizadas con ?tab=. */
@Component({
  selector: 'app-platform-plan-detail',
  imports: [
    RouterLink,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PlanBadgesComponent,
    PlanDataFormComponent,
    PlanFeaturesFormComponent,
    PlanLimitsFormComponent,
    PlanPricesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-plan-detail.component.html',
})
export class PlatformPlanDetailComponent {
  readonly #platform = inject(PlatformService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  readonly tabs = TABS;
  readonly subscriptionsLabel = subscriptionsLabel;

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), { initialValue: NaN });
  readonly $tab = toSignal(
    this.#route.queryParamMap.pipe(
      map((params) => {
        const tab = params.get('tab');
        return TABS.some((item) => item.id === tab) ? (tab as PlanTab) : 'data';
      }),
    ),
    { initialValue: 'data' as PlanTab },
  );

  // No hay GET de un plan: se usa el listado (también da los nombres para "También en").
  readonly plans = rxResource({ stream: () => this.#platform.getPlans().pipe(toRemoteResult()) });
  readonly $error = computed(() => resultError(this.plans.value()));
  // Copia local: cada guardado devuelve el plan actualizado y lo reemplaza sin recargar.
  readonly $plans = linkedSignal<PlatformPlanDto[]>(() => resultValue(this.plans.value()) ?? []);
  readonly $plan = computed(() => this.$plans().find((plan) => plan.id === this.$id()) ?? null);

  errorMessage(error: unknown): string {
    return getPlatformErrorMessage(error, 'Intenta nuevamente.');
  }

  selectTab(tab: PlanTab) {
    if (tab === this.$tab()) return;
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { tab: tab === 'data' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  handleSaved(updated: PlatformPlanDto) {
    this.$plans.update((plans) => plans.map((plan) => (plan.id === updated.id ? updated : plan)));
  }
}
