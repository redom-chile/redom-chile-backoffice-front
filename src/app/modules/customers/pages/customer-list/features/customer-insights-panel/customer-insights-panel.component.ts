import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService, isPlanError, PlanUpsellService } from 'src/app/core/services/entitlements';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { isFeatureNotIncluded, requiredPlansOf } from 'src/app/modules/public-menu/features/marketing-shared';
import { MarketingUpsellCardComponent } from 'src/app/modules/public-menu/features/marketing-upsell-card';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, IconComponent, PaginationTableComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  channelLabel,
  CustomerInsightsFilters,
  CustomerInsightsService,
  downloadBlob,
  fileNameOf,
  formatDate,
  InsightsSort,
  readBlobError,
  relativeDate,
  Segment,
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  SEGMENT_PRIORITY_TEXT,
  segmentHint,
} from 'src/app/modules/customers/data-access';
import { SegmentSettingsModalComponent } from '../segment-settings-modal';

const PER_PAGE = 20;

type ConsentFilter = 'all' | 'yes' | 'no';

/** Pestaña "Panel" de Clientes: segmentos, métricas y exportación (plan con customerInsights). */
@Component({
  selector: 'app-customer-insights-panel',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatTooltipModule,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PaginationTableComponent,
    CheckPermissionDirective,
    MarketingUpsellCardComponent,
  ],
  templateUrl: './customer-insights-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInsightsPanelComponent {
  readonly #service = inject(CustomerInsightsService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #locationsService = inject(GetAllBusinessLocationsService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #upsell = inject(PlanUpsellService);

  protected readonly PERMISSIONS = PERMISSIONS;
  readonly segments = SEGMENT_ORDER;
  readonly segmentLabels = SEGMENT_LABELS;
  readonly priorityText = SEGMENT_PRIORITY_TEXT;
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly relativeDate = relativeDate;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly sortColumns: ReadonlyArray<{ key: InsightsSort; label: string }> = [
    { key: 'visits', label: 'Visitas' },
    { key: 'totalSpent', label: 'Total gastado' },
    { key: 'lastVisitAt', label: 'Última visita' },
  ];

  readonly $hasFeature = computed(() => this.#entitlements.hasFeature('customerInsights'));

  // Filtros
  readonly search = new FormControl('', { nonNullable: true });
  readonly $q = signal('');
  readonly $segment = signal<Segment | null>(null);
  readonly $locationId = signal<number | null>(null);
  readonly $consent = signal<ConsentFilter>('all');
  readonly $sort = signal<InsightsSort>('lastVisitAt');
  readonly $page = signal(1);
  // Se sube tras guardar los segmentos para recargar todo.
  readonly #version = signal(0);
  readonly $exporting = signal(false);

  readonly $locations = computed(() =>
    (this.#locationsService.$locations() ?? []).filter((location) => location.isActive !== false).map(({ id, name }) => ({ id, name })),
  );

  readonly $filters = computed<CustomerInsightsFilters>(() => ({
    segment: this.$segment(),
    q: this.$q() || null,
    locationId: this.$locationId(),
    marketingConsent: this.$consent() === 'all' ? null : this.$consent() === 'yes',
  }));

  readonly summaryResource = rxResource({
    params: () => (this.$hasFeature() ? { locationId: this.$locationId(), version: this.#version() } : undefined),
    stream: ({ params }) => this.#service.summary(params.locationId).pipe(toRemoteResult()),
  });
  readonly listResource = rxResource({
    params: () => (this.$hasFeature() ? { ...this.$filters(), page: this.$page(), limit: PER_PAGE, sort: this.$sort(), version: this.#version() } : undefined),
    stream: ({ params }) => {
      const { version: _version, ...filters } = params;
      return this.#service.list(filters).pipe(toRemoteResult());
    },
  });
  readonly settingsResource = rxResource({
    params: () => (this.$hasFeature() ? this.#version() : undefined),
    stream: () => this.#service.getSegmentSettings().pipe(toRemoteResult()),
  });

  readonly $summary = computed(() => resultValue(this.summaryResource.value()));
  readonly $summaryError = computed(() => resultError(this.summaryResource.value()));
  readonly $summaryLoading = computed(() => this.summaryResource.isLoading() && !this.$summary());
  readonly $list = computed(() => resultValue(this.listResource.value()));
  readonly $listError = computed(() => resultError(this.listResource.value()));
  readonly $listLoading = computed(() => this.listResource.isLoading());
  readonly $settings = computed(() => resultValue(this.settingsResource.value()));

  readonly $blocked = computed(() => !this.$hasFeature() || isFeatureNotIncluded(this.$summaryError()) || isFeatureNotIncluded(this.$listError()));
  readonly $requiredPlans = computed(() => requiredPlansOf(this.$summaryError() ?? this.$listError()));

  readonly $pagination = computed(() => {
    const list = this.$list();
    if (!list) return null;
    return { page: list.page, perPage: list.limit, totalItems: list.total, totalPages: Math.max(1, Math.ceil(list.total / list.limit)) };
  });
  readonly $hasFilters = computed(() => {
    const filters = this.$filters();
    return !!filters.segment || !!filters.q || filters.marketingConsent !== null;
  });

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(350), map((value) => value.trim()), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((q) => {
        this.$q.set(q);
        this.$page.set(1);
      });
  }

  segmentHint(segment: Segment): string {
    return segmentHint(segment, this.$settings());
  }

  selectSegment(segment: Segment) {
    this.$segment.update((current) => (current === segment ? null : segment));
    this.$page.set(1);
  }

  onLocationChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.$locationId.set(value ? Number(value) : null);
    this.$page.set(1);
  }

  onConsentChange(event: Event) {
    this.$consent.set((event.target as HTMLSelectElement).value as ConsentFilter);
    this.$page.set(1);
  }

  selectSort(sort: InsightsSort) {
    this.$sort.set(sort);
    this.$page.set(1);
  }

  clearFilters() {
    this.search.setValue('', { emitEvent: false });
    this.$q.set('');
    this.$segment.set(null);
    this.$consent.set('all');
    this.$page.set(1);
  }

  reload() {
    this.summaryResource.reload();
    this.listResource.reload();
    this.settingsResource.reload();
  }

  openSettings() {
    this.#dialog
      .open<SegmentSettingsModalComponent, void, boolean>(SegmentSettingsModalComponent, { width: '520px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (!saved) return;
        this.#toast.show('Segmentos actualizados. Tus clientes ya están recalculados.', 'success');
        this.#version.update((version) => version + 1);
      });
  }

  handleExport() {
    if (this.$exporting()) return;
    this.$exporting.set(true);
    this.#service.exportCsv(this.$filters()).subscribe({
      next: (response) => {
        this.$exporting.set(false);
        if (!response.body) return;
        downloadBlob(response.body, fileNameOf(response.headers.get('Content-Disposition')) ?? `clientes-${new Date().toISOString().slice(0, 10)}.csv`);
        this.#toast.show('Exportación descargada', 'success');
      },
      error: async (error: unknown) => {
        this.$exporting.set(false);
        // Con blob el interceptor no alcanza a leer el código: el aviso del plan se abre aquí.
        const parsed = await readBlobError(error);
        if (isPlanError(parsed)) {
          this.#upsell.open({ features: ['customerInsights'], requiredPlans: requiredPlansOf(parsed) });
          return;
        }
        this.#toast.show('No se pudo exportar a CSV', 'error');
      },
    });
  }

  channelsText(channels: readonly string[]): string {
    return channels.length ? channels.map(channelLabel).join(', ') : '—';
  }

  displayName(name: string | null): string {
    return name?.trim() || 'Sin nombre';
  }
}
