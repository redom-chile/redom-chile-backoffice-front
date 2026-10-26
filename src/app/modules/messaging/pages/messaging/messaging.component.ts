import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AutomationListComponent } from 'src/app/modules/messaging/features/automation-list';
import { CampaignListComponent } from 'src/app/modules/messaging/features/campaign-list';
import { MessagingQuotaComponent } from 'src/app/modules/messaging/features/messaging-quota';
import { TabDirective, TabListDirective } from 'src/app/modules/public-menu/features/a11y-tabs';
import { HeaderDashboardComponent, IconComponent } from 'src/ui';

type Tab = 'automations' | 'campaigns';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: string }> = [
  { id: 'automations', label: 'Automáticos', icon: 'autorenew' },
  { id: 'campaigns', label: 'Campañas', icon: 'campaign' },
];

/** Clientes → Mensajería (etapa 10.2): cupo del mes y pestañas Automáticos / Campañas. Query param: tab. */
@Component({
  selector: 'app-messaging',
  imports: [HeaderDashboardComponent, IconComponent, TabDirective, TabListDirective, MessagingQuotaComponent, AutomationListComponent, CampaignListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tab = $tab();
    <app-header-dashboard title="Mensajería" subtitle="Correos a tus clientes: automáticos y campañas." />

    <div class="flex flex-col gap-4">
      <app-messaging-quota />

      <nav appTabList class="glass-input flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit" aria-label="Secciones de mensajería">
        @for (item of tabs; track item.id) {
        <button
          type="button"
          [id]="'messaging-tab-' + item.id"
          class="inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium sm:flex-none"
          [class]="tab === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
          [appTab]="tab === item.id"
          tabPanel="messaging-panel"
          (click)="selectTab(item.id)">
          <app-icon class="h-4 w-4" aria-hidden="true">{{ item.icon }}</app-icon>{{ item.label }}
        </button>
        }
      </nav>

      <div id="messaging-panel" role="tabpanel" [attr.aria-labelledby]="'messaging-tab-' + tab">
        @if (tab === 'automations') {
        <app-automation-list />
        } @else {
        <app-campaign-list />
        }
      </div>
    </div>
  `,
})
export class MessagingComponent {
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);

  readonly tabs = TABS;
  readonly #tabParam = toSignal(this.#route.queryParamMap.pipe(map((params) => params.get('tab'))), { initialValue: null });
  readonly $tab = computed<Tab>(() => (this.#tabParam() === 'campaigns' ? 'campaigns' : 'automations'));

  selectTab(tab: Tab) {
    if (tab === this.$tab()) return;
    this.#router.navigate([], { relativeTo: this.#route, queryParams: { tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}
