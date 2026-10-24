import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, output, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { ButtonComponent, EmptyStateComponent, IconComponent } from 'src/ui';
import { getMenuAiErrorMessage, isRouteMissing, MenuAiService } from '../data-access';
import { MenuAiTab } from '../menu-ai-shared';
import { MenuAiStore } from '../menu-ai.store';
import { MenuAiQuotaComponent } from './menu-ai-quota.component';

type Card = Readonly<{ id: string; label: string; hint: string; icon: string; count: number; tab: MenuAiTab | null }>;

/** Resumen: lo que le falta a la carta, la cuota del mes y el estado de la IA. */
@Component({
  selector: 'app-menu-ai-overview',
  imports: [RouterLink, DatePipe, NgTemplateOutlet, IconComponent, ButtonComponent, EmptyStateComponent, MenuAiQuotaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($isLoading()) {
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      @for (i of [1, 2, 3, 4]; track i) {
      <div class="bg-muted h-28 animate-pulse rounded-[1rem]"></div>
      }
    </div>
    } @else if ($overview(); as overview) {
    <p class="text-muted-foreground mb-3 text-sm">
      {{ overview.counts.products === 1 ? '1 producto a la venta' : overview.counts.products + ' productos a la venta' }}
    </p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (card of $cards(); track card.id) {
      @if (card.tab; as tab) {
      <button type="button" class="glass flex flex-col items-start gap-1 rounded-[1rem] p-4 text-left transition hover:ring-2 hover:ring-[var(--primary)]/40" (click)="goTo.emit(tab)">
        <ng-container *ngTemplateOutlet="cardBody; context: { $implicit: card }" />
      </button>
      } @else {
      <a routerLink="/products" class="glass flex flex-col items-start gap-1 rounded-[1rem] p-4 transition hover:ring-2 hover:ring-[var(--primary)]/40">
        <ng-container *ngTemplateOutlet="cardBody; context: { $implicit: card }" />
      </a>
      }
      }
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section class="glass rounded-[1rem] p-4" aria-labelledby="menu-ai-quota-title">
        <h2 id="menu-ai-quota-title" class="text-foreground mb-2 text-sm font-semibold">Uso del mes</h2>
        <app-menu-ai-quota [quota]="store.$quota() ?? overview.quota" />
        <p class="text-muted-foreground mt-2 text-xs">Cada producto con sugerencias de descripción cuenta 1. Las etiquetas y las sugerencias de precio no cuentan.</p>
      </section>
      <section class="glass flex flex-col gap-2 rounded-[1rem] p-4" aria-labelledby="menu-ai-status-title">
        <h2 id="menu-ai-status-title" class="text-foreground text-sm font-semibold">Estado</h2>
        <p class="flex items-center gap-2 text-sm">
          <span class="h-2.5 w-2.5 rounded-full" [class]="$isEnabled() ? 'bg-green-500' : 'bg-muted-foreground/50'" aria-hidden="true"></span>
          IA para descripciones y etiquetas: <span class="font-semibold">{{ $isEnabled() ? 'activada' : 'apagada' }}</span>
        </p>
        <p class="flex items-center gap-2 text-sm">
          <span class="h-2.5 w-2.5 rounded-full" [class]="$insightsEnabled() ? 'bg-green-500' : 'bg-muted-foreground/50'" aria-hidden="true"></span>
          Sugerencias de precio y promociones: <span class="font-semibold">{{ $insightsEnabled() ? 'activadas' : 'apagadas' }}</span>
        </p>
        @if (overview.lastInsightsAt) {
        <p class="text-muted-foreground text-xs">Últimas sugerencias: {{ overview.lastInsightsAt | date: "d 'de' MMMM, HH:mm" }}</p>
        }
        <button type="button" class="text-primary mt-1 inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline" (click)="openSettings()">
          <app-icon class="h-4 w-4" aria-hidden="true">tune</app-icon>{{ $isEnabled() ? 'Cambiar la configuración' : 'Activar en Configuración' }}
        </button>
      </section>
    </div>
    } @else if (!store.$unavailable() && $error()) {
    <app-empty-state icon="cloud_off" title="No se pudo cargar el resumen" [description]="$errorMessage()">
      <app-button impact="light" tone="primary" size="small" type="button" icon="refresh" (buttonClick)="overview.reload()">Reintentar</app-button>
    </app-empty-state>
    } @else if (store.$unavailable()) {
    <app-empty-state icon="auto_awesome" title="Resumen no disponible" description="Este servidor no tiene la IA para la carta." />
    }

    <ng-template #cardBody let-card>
      <span class="text-primary flex items-center gap-2 text-sm font-medium">
        <app-icon class="h-5 w-5" aria-hidden="true">{{ card.icon }}</app-icon>{{ card.label }}
      </span>
      <span class="text-foreground text-3xl font-bold tabular-nums">{{ card.count }}</span>
      <span class="text-muted-foreground flex items-center gap-1 text-xs">
        {{ card.hint }}<app-icon class="h-3.5 w-3.5" aria-hidden="true">arrow_forward</app-icon>
      </span>
    </ng-template>
  `,
})
export class MenuAiOverviewComponent {
  readonly #service = inject(MenuAiService);
  readonly store = inject(MenuAiStore);

  readonly goTo = output<MenuAiTab>();

  readonly overview = rxResource({
    params: () => (this.store.$hasFeature() && !this.store.$unavailable() ? { version: this.store.$overviewVersion() } : undefined),
    stream: () => this.#service.getOverview().pipe(toRemoteResult()),
  });
  readonly $overview = computed(() => resultValue(this.overview.value()));
  readonly $error = computed(() => resultError(this.overview.value()));
  readonly $errorMessage = computed(() => getMenuAiErrorMessage(this.$error(), 'Inténtalo de nuevo en unos minutos.') ?? 'Tu plan no incluye esta función.');
  readonly $isLoading = computed(() => this.overview.isLoading() && !this.$overview());

  // El resumen manda sobre la configuración en memoria (puede haber cambiado en otra sesión).
  readonly $isEnabled = computed(() => this.store.$isEnabled() ?? this.$overview()?.settings.isEnabled ?? false);
  readonly $insightsEnabled = computed(() => this.store.$insightsEnabled() ?? this.$overview()?.settings.insightsEnabled ?? false);

  openSettings() {
    if (!this.$isEnabled()) this.store.$focusSetting.set('isEnabled');
    this.goTo.emit('settings');
  }

  readonly $cards = computed<Card[]>(() => {
    const counts = this.$overview()?.counts;
    if (!counts) return [];
    return [
      { id: 'description', label: 'Sin descripción', hint: 'Completar con IA', icon: 'edit_note', count: counts.withoutDescription, tab: 'descriptions' },
      { id: 'photo', label: 'Sin foto', hint: 'Ir a Productos', icon: 'no_photography', count: counts.withoutPhoto, tab: null },
      { id: 'tags', label: 'Sin etiquetas', hint: 'Revisar etiquetas', icon: 'sell', count: counts.withoutTags, tab: 'tags' },
      { id: 'margin', label: 'Margen bajo', hint: 'Ver sugerencias', icon: 'trending_down', count: counts.lowMargin, tab: 'insights' },
    ];
  });

  constructor() {
    effect(() => {
      const error = this.$error();
      if (isRouteMissing(error)) untracked(() => this.store.markUnavailable());
    });
    effect(() => {
      const overview = this.$overview();
      if (overview) untracked(() => this.store.syncFromOverview(overview));
    });
  }
}
