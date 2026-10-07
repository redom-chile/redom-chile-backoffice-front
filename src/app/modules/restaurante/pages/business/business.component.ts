import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent } from 'src/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { FindMyBusinessesService } from './data-access';
import { BusinessDetailComponent, InventorySettingsComponent } from './features';
import { BusinessDetailSkeletonComponent } from './ui';

type BusinessTab = 'general' | 'inventario';

function toTab(value: string | null): BusinessTab {
  return value === 'inventario' ? 'inventario' : 'general';
}

@Component({
  selector: 'app-business',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    BusinessDetailComponent,
    BusinessDetailSkeletonComponent,
    EmptyStateComponent,
    InventorySettingsComponent,
  ],
  templateUrl: './business.component.html',
  styleUrl: './business.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly $findMyBusinessesService = inject(FindMyBusinessesService);
  readonly #settings = inject(BusinessSettingsService);

  readonly tabs: ReadonlyArray<{ value: BusinessTab; label: string }> = [
    { value: 'general', label: 'General' },
    { value: 'inventario', label: 'Inventario' },
  ];
  // Pestaña sincronizada con ?tab=inventario (sin parámetro = General).
  readonly $tab = toSignal(this.route.queryParamMap.pipe(map((params) => toTab(params.get('tab')))), {
    initialValue: toTab(this.route.snapshot.queryParamMap.get('tab')),
  });

  constructor() {
    this.$findMyBusinessesService.retry();
  }

  get business() {
    return this.$findMyBusinessesService.$businesses()?.[0];
  }

  get isLoading() {
    return this.$findMyBusinessesService.$isLoading();
  }

  retry() {
    this.$findMyBusinessesService.retry();
    this.#settings.reload();
  }

  selectTab(tab: BusinessTab) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'general' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  // Sin negocio: se crea desde el onboarding.
  goToOnboarding() {
    this.router.navigate(['/onboarding']);
  }
}
