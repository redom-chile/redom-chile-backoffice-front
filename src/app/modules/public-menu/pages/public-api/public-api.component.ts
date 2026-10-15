import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { PUBLIC_API_DOCS_URL } from 'src/app/modules/public-menu/data-access';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { PublicApiKeysComponent } from 'src/app/modules/public-menu/features/public-api-keys';
import { PublicApiWebhooksComponent } from 'src/app/modules/public-menu/features/public-api-webhooks';
import { PublicApiWidgetComponent } from 'src/app/modules/public-menu/features/public-api-widget';
import { HeaderDashboardComponent, IconComponent } from 'src/ui';

type Tab = 'keys' | 'webhooks' | 'widget';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string }> = [
  { id: 'keys', label: 'Llaves', icon: 'key' },
  { id: 'webhooks', label: 'Webhooks', icon: 'webhook' },
  { id: 'widget', label: 'Widget', icon: 'code' },
];

/** Configuración → API y widget: llaves, webhooks y el widget de la carta. Query param: tab (keys|webhooks|widget). */
@Component({
  selector: 'app-public-api',
  imports: [HeaderDashboardComponent, IconComponent, MarketingUpsellCardComponent, PublicApiKeysComponent, PublicApiWebhooksComponent, PublicApiWidgetComponent],
  templateUrl: './public-api.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicApiComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #entitlements = inject(EntitlementsService);

  readonly #access = inject(AccessService);
  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('public_api'));
  /** Llaves y webhooks: con su permiso, o el aviso del plan para quien configura la carta. Sin eso, solo el widget. */
  readonly $canSeeApi = computed(
    () => this.#access.can(PERMISSIONS.PUBLIC_API.SEE_MODULE) || (!this.$hasFeature() && this.#access.can(PERMISSIONS.PUBLIC_MENU.MANAGE_SETTINGS)),
  );
  readonly $tabs = computed(() => (this.$canSeeApi() ? TABS : TABS.filter((tab) => tab.id === 'widget')));
  readonly docsUrl = PUBLIC_API_DOCS_URL;

  readonly #tabParam = toSignal(this.#route.queryParamMap.pipe(map((params) => params.get('tab'))), { initialValue: null });
  readonly $tab = computed<Tab>(() => this.$tabs().find((tab) => tab.id === this.#tabParam())?.id ?? this.$tabs()[0].id);
  // Antes de llamar a la API: sin la función del plan se muestra el llamado a mejorarlo.

  selectTab(tab: Tab) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
