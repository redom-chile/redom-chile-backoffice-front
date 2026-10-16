import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService, PlanFeatureCode } from 'src/app/core/services/entitlements';
import { TabDirective, TabListDirective } from 'src/app/modules/public-menu/features/a11y-tabs';
import { MarketingBannersComponent } from 'src/app/modules/public-menu/features/marketing-banners';
import { MarketingBrandingComponent } from 'src/app/modules/public-menu/features/marketing-branding';
import { MarketingPromotionsComponent } from 'src/app/modules/public-menu/features/marketing-promotions';
import { MarketingLocation } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ConfirmModalComponent, ConfirmModalData, HeaderDashboardComponent, IconComponent } from 'src/ui';

type Tab = 'promotions' | 'banners' | 'branding';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string; feature: PlanFeatureCode; description: string }> = [
  {
    id: 'promotions',
    label: 'Promociones',
    icon: 'sell',
    feature: 'menu_marketing',
    description: 'Crea promociones con horario, banners y una ventana de ofertas para tu carta pública.',
  },
  {
    id: 'banners',
    label: 'Banners',
    icon: 'view_carousel',
    feature: 'menu_marketing',
    description: 'Muestra banners con tus recomendaciones y una ventana de ofertas al abrir la carta.',
  },
  {
    id: 'branding',
    label: 'Personalización',
    icon: 'palette',
    feature: 'menu_branding',
    description: 'Pon los colores de tu marca y una foto de portada en la carta pública de cada local.',
  },
];

/** Configuración → Marketing de la carta: promociones, banners y personalización. Query params: tab, locationId. */
@Component({
  selector: 'app-menu-marketing',
  imports: [
    TabDirective,
    TabListDirective,
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    CheckPermissionDirective,
    MarketingPromotionsComponent,
    MarketingBannersComponent,
    MarketingBrandingComponent,
    MarketingUpsellCardComponent,
  ],
  templateUrl: './menu-marketing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class MenuMarketingComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #entitlements = inject(EntitlementsService);
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly #business = inject(BusinessSettingsService);
  readonly #dialog = inject(MatDialog);
  private readonly brandingRef = viewChild(MarketingBrandingComponent);

  readonly PERMISSIONS = PERMISSIONS;
  readonly tabs = TABS;
  readonly $timeZone = computed(() => this.#business.$settings()?.timeZone ?? null);

  readonly #params = toSignal(this.#route.queryParamMap.pipe(map((params) => ({ tab: params.get('tab'), locationId: Number(params.get('locationId')) || null }))), {
    initialValue: { tab: null, locationId: null },
  });
  readonly $tab = computed<Tab>(() => TABS.find((tab) => tab.id === this.#params().tab)?.id ?? 'promotions');
  readonly $tabInfo = computed(() => TABS.find((tab) => tab.id === this.$tab())!);
  // Antes de llamar a la API: si el plan no la incluye se muestra el llamado a mejorarlo.
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature(this.$tabInfo().feature));

  readonly $locations = computed<MarketingLocation[]>(() =>
    (this.#locationsService.$locations() ?? []).filter((location) => location.isActive !== false).map(({ id, name }) => ({ id, name })),
  );
  readonly $isLoadingLocations = computed(() => !!this.#locationsService.$isLoading() && !this.#locationsService.$locations());
  /** Filtro de promociones y banners (null = todos). */
  readonly $locationId = computed(() => {
    const id = this.#params().locationId;
    return id && this.$locations().some((location) => location.id === id) ? id : null;
  });
  /** La personalización es siempre de un local. */
  readonly $brandingLocationId = computed(() => this.$locationId() ?? this.$locations()[0]?.id ?? null);
  readonly $brandingLocationName = computed(() => this.$locations().find((location) => location.id === this.$brandingLocationId())?.name ?? '');
  readonly $selectedLocationId = computed(() => (this.$tab() === 'branding' ? this.$brandingLocationId() : this.$locationId()));

  /** Colores o portada sin guardar en Personalización (lo usa unsavedChangesGuard). */
  hasUnsavedChanges(): boolean {
    return this.brandingRef()?.hasUnsavedChanges() ?? false;
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  selectTab(tab: Tab) {
    if (tab === this.$tab()) return;
    this.#navigate({ tab });
  }

  onLocationChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    // Si se cancela, el selector vuelve al local actual.
    this.#navigate({ locationId: value ? Number(value) : null }, () => (select.value = String(this.$selectedLocationId() ?? '')));
  }

  /** Cambia pestaña o local pidiendo confirmación si hay cambios sin guardar. */
  #navigate(queryParams: Record<string, unknown>, onCancel?: () => void) {
    this.#confirmDiscard().subscribe((confirmed) => {
      if (!confirmed) {
        onCancel?.();
        return;
      }
      this.brandingRef()?.discard();
      this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  #confirmDiscard(): Observable<boolean> {
    if (!this.hasUnsavedChanges()) return of(true);
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Hay cambios sin guardar',
          message: 'Cambiaste colores o la portada y no los guardaste. Si sigues, se pierden.',
          confirmText: 'Descartar cambios',
          cancelText: 'Seguir editando',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }
}
