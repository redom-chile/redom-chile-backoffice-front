import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { readApiError } from 'src/app/core/utils/api-error';
import { formatCurrency, formatDateTime } from 'src/app/modules/orders/pages/order-list/ui';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';
import {
  channelLabel,
  CustomerInsightsService,
  formatDate,
  MESSAGE_KIND_LABELS,
  messageReasonLabel,
  messageStatusOf,
  messageTypeLabel,
  relativeDate,
  SEGMENT_LABELS,
  segmentHint,
} from 'src/app/modules/customers/data-access';

/** Pestaña "Actividad" de la ficha: métricas del panel, últimas ventas y correos enviados. */
@Component({
  selector: 'app-customer-activity',
  imports: [RouterLink, MatTooltipModule, ButtonComponent, IconComponent, SkeletonComponent, MarketingUpsellCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-activity.component.html',
})
export class CustomerActivityComponent {
  readonly #service = inject(CustomerInsightsService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #locationsService = inject(GetAllBusinessLocationsService);

  readonly contactId = input.required<number>();

  readonly formatCurrency = formatCurrency;
  readonly formatDateTime = formatDateTime;
  readonly formatDate = formatDate;
  readonly relativeDate = relativeDate;
  readonly segmentLabels = SEGMENT_LABELS;
  readonly kindLabels = MESSAGE_KIND_LABELS;
  readonly messageTypeLabel = messageTypeLabel;
  readonly messageStatusOf = messageStatusOf;
  readonly messageReasonLabel = messageReasonLabel;
  readonly channelLabel = channelLabel;

  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('customerInsights'));

  readonly insightResource = rxResource({
    params: () => (this.$hasFeature() ? this.contactId() : undefined),
    stream: ({ params }) => this.#service.detail(params).pipe(toRemoteResult()),
  });
  // Solo para explicar el segmento con los valores actuales.
  readonly settingsResource = rxResource({
    params: () => (this.$hasFeature() ? true : undefined),
    stream: () => this.#service.getSegmentSettings().pipe(toRemoteResult()),
  });

  readonly $insight = computed(() => resultValue(this.insightResource.value()));
  readonly $error = computed(() => resultError(this.insightResource.value()));
  readonly $loading = computed(() => this.insightResource.isLoading() && !this.$insight());
  readonly $blocked = computed(() => !this.$hasFeature() || isFeatureNotIncluded(this.$error()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$error()));
  // 404 sin compras: el panel solo tiene clientes con ventas.
  readonly $noPurchases = computed(() => readApiError(this.$error()).status === 404);
  readonly $segmentHint = computed(() => {
    const insight = this.$insight();
    return insight ? segmentHint(insight.segment, resultValue(this.settingsResource.value())) : '';
  });

  readonly #locationNames = computed(() => new Map((this.#locationsService.$locations() ?? []).map((location) => [location.id, location.name])));
  readonly $showLocation = computed(() => this.#locationNames().size > 1);

  locationName(id: number): string {
    return this.#locationNames().get(id) ?? '';
  }

  channelsText(channels: readonly string[]): string {
    return channels.length ? channels.map(channelLabel).join(', ') : '—';
  }
}
