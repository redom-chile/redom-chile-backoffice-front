import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService, PlanFeatureCode } from 'src/app/core/services/entitlements';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { getPublicMenuErrorMessage, MenuSettingsService } from 'src/app/modules/public-menu/data-access';
import { TabDirective, TabListDirective } from 'src/app/modules/public-menu/features/a11y-tabs';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { MenuDynamicDailyComponent } from 'src/app/modules/public-menu/features/menu-dynamic-daily';
import { MenuDynamicMomentsComponent } from 'src/app/modules/public-menu/features/menu-dynamic-moments';
import { MenuDynamicSeasonsComponent } from 'src/app/modules/public-menu/features/menu-dynamic-seasons';
import { MenuDynamicCatalogService } from 'src/app/modules/public-menu/features/menu-dynamic-shared';
import { MenuDynamicSuggestionsComponent } from 'src/app/modules/public-menu/features/menu-dynamic-suggestions';
import { MenuDynamicWeatherComponent } from 'src/app/modules/public-menu/features/menu-dynamic-weather';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ConfirmModalComponent, ConfirmModalData, HeaderDashboardComponent, IconComponent } from 'src/ui';

type Tab = 'moments' | 'seasons' | 'daily' | 'suggestions' | 'weather';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string; feature: PlanFeatureCode; description: string }> = [
  {
    id: 'moments',
    label: 'Momentos',
    icon: 'schedule',
    feature: 'menuDynamic',
    description: 'Desayuno, almuerzo, once o happy hour: la carta destaca o muestra solo lo de cada momento, y cambia sola.',
  },
  {
    id: 'seasons',
    label: 'Temporadas',
    icon: 'celebration',
    feature: 'menuDynamic',
    description: 'Fiestas Patrias, Navidad o verano: destacados y banners que se activan solos entre dos fechas.',
  },
  {
    id: 'daily',
    label: 'Plato del día',
    icon: 'restaurant',
    feature: 'menuDynamicPlus',
    description: 'Un plato destacado con porciones y cuenta regresiva: "Quedan 5", "Hasta las 15:00".',
  },
  {
    id: 'suggestions',
    label: 'Sugerencias',
    icon: 'add_shopping_cart',
    feature: 'menuDynamic',
    description: 'Sugiere bebidas, postres o acompañamientos en el carrito con tus reglas ("con hamburguesa, sugerir papas").',
  },
  {
    id: 'weather',
    label: 'Clima',
    icon: 'partly_cloudy_day',
    feature: 'menuDynamicPlus',
    description: 'Destaca sopas cuando llueve o bebidas frías con calor, según el clima actual de cada local.',
  },
];

const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

/**
 * Configuración → Carta online → Carta dinámica (etapa 11): momentos, temporadas, plato del día, sugerencias y clima,
 * por local. Query params: locationId, tab (moments|seasons|daily|suggestions|weather).
 */
@Component({
  selector: 'app-menu-dynamic',
  imports: [
    RouterLink,
    TabDirective,
    TabListDirective,
    HeaderDashboardComponent,
    IconComponent,
    ButtonComponent,
    CheckPermissionDirective,
    MarketingUpsellCardComponent,
    MenuDynamicMomentsComponent,
    MenuDynamicSeasonsComponent,
    MenuDynamicDailyComponent,
    MenuDynamicSuggestionsComponent,
    MenuDynamicWeatherComponent,
  ],
  templateUrl: './menu-dynamic.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class MenuDynamicComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #dialog = inject(MatDialog);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #business = inject(BusinessSettingsService);
  readonly #settingsService = inject(MenuSettingsService);
  readonly #catalogService = inject(MenuDynamicCatalogService);
  private readonly suggestionsRef = viewChild(MenuDynamicSuggestionsComponent);
  private readonly weatherRef = viewChild(MenuDynamicWeatherComponent);

  readonly PERMISSIONS = PERMISSIONS;
  readonly tabs = TABS;
  readonly $timeZone = computed(() => this.#business.$settings()?.timeZone ?? null);
  readonly $canManage = computed(() => this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_MARKETING));
  readonly $hasDynamic = computed(() => this.#entitlements.hasFeature('menuDynamic'));
  readonly $hasPlus = computed(() => this.#entitlements.hasFeature('menuDynamicPlus'));

  readonly #params = toSignal(this.#route.queryParamMap.pipe(map((params) => ({ tab: params.get('tab'), locationId: Number(params.get('locationId')) || null }))), {
    initialValue: { tab: null, locationId: null },
  });
  readonly $tab = computed<Tab>(() => {
    const tab = this.#params().tab;
    return isTab(tab) ? tab : 'moments';
  });
  readonly $tabInfo = computed(() => TABS.find((tab) => tab.id === this.$tab())!);
  readonly $tabAllowed = computed(() => this.#entitlements.hasFeature(this.$tabInfo().feature));

  // --- Locales ---
  readonly settings = rxResource({ stream: () => this.#settingsService.getSettings().pipe(toRemoteResult()) });
  readonly $locations = computed(() => resultValue(this.settings.value()) ?? []);
  readonly $settingsError = computed(() => {
    const error = resultError(this.settings.value());
    return error ? getPublicMenuErrorMessage(error, 'No se pudieron cargar los locales.') : null;
  });
  readonly $isLoadingLocations = computed(() => this.settings.isLoading() && !this.$locations().length);
  readonly $locationId = computed(() => {
    const id = this.#params().locationId;
    const list = this.$locations();
    return list.some((item) => item.locationId === id) ? id : (list[0]?.locationId ?? null);
  });
  readonly $location = computed(() => this.$locations().find((item) => item.locationId === this.$locationId()) ?? null);
  readonly $hasCoordinates = computed(() => {
    const location = this.$location();
    return location?.latitude != null && location?.longitude != null;
  });

  // --- Productos y categorías (para elegir y mostrar nombres) ---
  readonly catalog = rxResource({
    params: () => (this.$hasDynamic() || this.$hasPlus() ? true : undefined),
    stream: () => this.#catalogService.load().pipe(toRemoteResult()),
  });
  readonly $catalog = computed(() => resultValue(this.catalog.value()));
  readonly $catalogLoading = computed(() => this.catalog.isLoading());
  readonly $catalogFailed = computed(() => !!resultError(this.catalog.value()));

  hasUnsavedChanges(): boolean {
    return (this.suggestionsRef()?.hasUnsavedChanges() ?? false) || (this.weatherRef()?.hasUnsavedChanges() ?? false);
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  isLocked(feature: PlanFeatureCode): boolean {
    return !this.#entitlements.hasFeature(feature);
  }

  selectTab(tab: Tab) {
    if (tab === this.$tab()) return;
    this.#confirmDiscard().subscribe((confirmed) => confirmed && this.#navigate({ tab }));
  }

  onLocationChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const locationId = Number(select.value) || null;
    this.#confirmDiscard().subscribe((confirmed) => {
      if (!confirmed) {
        select.value = String(this.$locationId() ?? '');
        return;
      }
      this.#navigate({ locationId });
    });
  }

  #navigate(queryParams: Record<string, unknown>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  #confirmDiscard(): Observable<boolean> {
    if (!this.hasUnsavedChanges()) return of(true);
    return this.#dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Hay cambios sin guardar',
          message: 'Cambiaste la configuración y no la guardaste. Si sigues, se pierde.',
          confirmText: 'Descartar cambios',
          cancelText: 'Seguir editando',
          tone: 'danger',
        },
      })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
  }
}
