import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { resultError, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { getLoyaltyErrorMessage, isLoyaltyPlanBlocked, LoyaltyProgramDto, LoyaltyService } from 'src/app/modules/loyalty/data-access';
import { LoyaltyCustomersComponent } from 'src/app/modules/loyalty/features/loyalty-customers';
import { LoyaltyProgramComponent } from 'src/app/modules/loyalty/features/loyalty-program';
import { LoyaltyRewardsComponent } from 'src/app/modules/loyalty/features/loyalty-rewards';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';

type Tab = 'program' | 'rewards' | 'customers';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string }> = [
  { id: 'program', label: 'Programa', icon: 'loyalty' },
  { id: 'rewards', label: 'Recompensas', icon: 'redeem' },
  { id: 'customers', label: 'Clientes', icon: 'person_search' },
];

const UPSELL = 'Premia a tus clientes con puntos o sellos por cada compra y deja que los canjeen en la caja.';

/** Fidelización: programa, recompensas y saldo de los clientes. Query param: tab. */
@Component({
  selector: 'app-loyalty',
  imports: [
    HeaderDashboardComponent,
    IconComponent,
    ButtonComponent,
    SkeletonComponent,
    MarketingUpsellCardComponent,
    LoyaltyProgramComponent,
    LoyaltyRewardsComponent,
    LoyaltyCustomersComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loyalty.component.html',
})
export class LoyaltyComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #entitlements = inject(EntitlementsService);
  readonly #service = inject(LoyaltyService);

  readonly tabs = TABS;
  readonly upsell = UPSELL;

  readonly #tabParam = toSignal(this.#route.queryParamMap.pipe(map((params) => params.get('tab'))), { initialValue: null });
  readonly $tab = computed<Tab>(() => TABS.find((tab) => tab.id === this.#tabParam())?.id ?? 'program');
  // Sin la función del plan no se llama a la API.
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('loyalty'));

  // El programa lo comparten las pestañas (la mecánica define "puntos" o "sellos").
  readonly program = rxResource({
    params: () => (this.$hasFeature() ? true : undefined),
    stream: () => this.#service.getProgram().pipe(toRemoteResult()),
  });
  readonly $program = linkedSignal<LoyaltyProgramDto | null | undefined>(() => {
    const result = this.program.value();
    return result?.ok ? result.value : undefined;
  });
  readonly $error = computed(() => resultError(this.program.value()));
  readonly $blocked = computed(() => isLoyaltyPlanBlocked(this.$error()));
  readonly $errorMessage = computed(() => getLoyaltyErrorMessage(this.$error(), 'No se pudo cargar el programa.') ?? 'No se pudo cargar el programa.');
  readonly $mechanic = computed(() => this.$program()?.mechanic ?? null);

  selectTab(tab: Tab) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  onProgramSaved(program: LoyaltyProgramDto) {
    this.$program.set(program);
  }
}
