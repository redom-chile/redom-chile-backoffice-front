import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TabDirective, TabListDirective } from 'src/app/modules/public-menu/features/a11y-tabs';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { HeaderDashboardComponent, IconComponent } from 'src/ui';
import { MenuAiDescriptionsComponent } from './features/menu-ai-descriptions.component';
import { MenuAiInsightsComponent } from './features/menu-ai-insights.component';
import { MenuAiOverviewComponent } from './features/menu-ai-overview.component';
import { MenuAiSettingsComponent } from './features/menu-ai-settings.component';
import { MenuAiTagsComponent } from './features/menu-ai-tags.component';
import { isMenuAiTab, MENU_AI_TABS, MenuAiTab, UNAVAILABLE_MESSAGE } from './menu-ai-shared';
import { MenuAiStore } from './menu-ai.store';

/**
 * Carta → Mejorar con IA. Query params: tab (overview|descriptions|tags|insights|settings), locationId (sugerencias),
 * setting (ajuste a enfocar en Configuración, p. ej. isEnabled).
 */
@Component({
  selector: 'app-menu-ai',
  imports: [
    TabDirective,
    TabListDirective,
    HeaderDashboardComponent,
    IconComponent,
    MarketingUpsellCardComponent,
    MenuAiOverviewComponent,
    MenuAiDescriptionsComponent,
    MenuAiTagsComponent,
    MenuAiInsightsComponent,
    MenuAiSettingsComponent,
  ],
  providers: [MenuAiStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
  template: `
    @let tab = $tab();
    <app-header-dashboard title="Mejorar mi carta" subtitle="La IA te sugiere descripciones, etiquetas, precios y promociones. Tú decides qué aplicar." />

    @if (!store.$hasFeature() || store.$blocked()) {
    <app-marketing-upsell-card
      feature="menuAiContent"
      [requiredPlans]="store.$requiredPlans()"
      description="Completa las descripciones de tus productos, revisa sus etiquetas a partir de la receta y recibe sugerencias de precios y promociones con tus ventas." />
    } @else {
    @if (store.$unavailable()) {
    <div class="mb-4 flex items-start gap-2 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-300" role="status">
      <app-icon class="h-5 w-5 shrink-0" aria-hidden="true">construction</app-icon>
      <p>{{ unavailableMessage }}</p>
    </div>
    }

    <nav appTabList class="glass-input mb-4 flex w-full gap-1 overflow-x-auto rounded-full p-1 lg:w-fit" aria-label="Secciones">
      @for (item of tabs; track item.id) {
      <button
        type="button"
        [id]="'menu-ai-tab-' + item.id"
        class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium"
        [class]="tab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        [appTab]="tab === item.id"
        tabPanel="menu-ai-panel"
        (click)="selectTab(item.id)">
        <app-icon class="h-4 w-4" aria-hidden="true">{{ item.icon }}</app-icon>{{ item.label }}
      </button>
      }
    </nav>

    <div id="menu-ai-panel" role="tabpanel" [attr.aria-labelledby]="'menu-ai-tab-' + tab">
      @switch (tab) {
      @case ('overview') {
      <app-menu-ai-overview (goTo)="selectTab($event)" />
      }
      @case ('descriptions') {
      <app-menu-ai-descriptions (goTo)="selectTab($event)" />
      }
      @case ('tags') {
      <app-menu-ai-tags (goTo)="selectTab($event)" />
      }
      @case ('insights') {
      <app-menu-ai-insights [locationId]="$locationId()" (locationChange)="selectLocation($event)" (goTo)="selectTab($event)" />
      }
      @case ('settings') {
      <app-menu-ai-settings />
      }
      }
    </div>
    }
  `,
})
export class MenuAiComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly store = inject(MenuAiStore);

  readonly tabs = MENU_AI_TABS;
  readonly unavailableMessage = UNAVAILABLE_MESSAGE;

  readonly #params = toSignal(
    this.#route.queryParamMap.pipe(map((params) => ({ tab: params.get('tab'), locationId: Number(params.get('locationId')) || null }))),
    { initialValue: { tab: null, locationId: null } },
  );

  constructor() {
    const setting = this.#route.snapshot.queryParamMap.get('setting');
    if (setting === 'isEnabled' || setting === 'insightsEnabled') this.store.$focusSetting.set(setting);
  }
  readonly $tab = computed<MenuAiTab>(() => {
    const tab = this.#params().tab;
    return isMenuAiTab(tab) ? tab : 'overview';
  });
  readonly $locationId = computed(() => this.#params().locationId);

  selectTab(tab: MenuAiTab) {
    if (tab === this.$tab()) return;
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { tab: tab === 'overview' ? null : tab, setting: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  selectLocation(locationId: number | null) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { locationId }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  // Las sugerencias sin aplicar ya gastaron cuota: avisar antes de salir.
  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.store.$hasPendingWork()) return;
    event.preventDefault();
    event.returnValue = '';
  }
}
