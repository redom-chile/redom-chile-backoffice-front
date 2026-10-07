import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { interval, map } from 'rxjs';
import { ButtonComponent, IconComponent, SkeletonComponent } from 'src/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { paymentMethodLabel } from 'src/app/modules/payments/pages/payment-list/ui';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { InventoryLocationStore } from 'src/app/modules/inventory/data-access';
import { ExpiryAlertComponent, LowStockAlertComponent } from 'src/app/modules/inventory/pages/stock/features';
import { GetDashboardMetricsService } from './data-access';
import { KpiCardComponent, RecentOrdersCardComponent, TopProductsCardComponent } from './features';
import {
  BreakdownChartComponent,
  BreakdownItem,
  comparisonLabel,
  PeriodPreset,
  periodRange,
  PeriodSelectorComponent,
  SalesByDayChartComponent,
  toDateKey,
} from './ui';

// Con el día de hoy en el rango, los números se refrescan solos.
const REFRESH_MS = 60_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS: PeriodPreset[] = ['today', 'yesterday', '7d', 'month', 'custom'];

// location: número = sucursal; 'all' = todas (elegido explícitamente); null = sin elegir (usa la del usuario).
type DashboardQuery = Readonly<{ preset: PeriodPreset; from: string; to: string; location: number | 'all' | null }>;

function toQuery(params: ParamMap): DashboardQuery {
  const preset = (PRESETS.includes(params.get('range') as PeriodPreset) ? params.get('range') : 'today') as PeriodPreset;
  const from = params.get('from');
  const to = params.get('to');
  const custom = from && to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to) ? { from, to } : undefined;
  const range = periodRange(preset === 'custom' && !custom ? 'today' : preset, custom);
  const raw = params.get('location');
  const location = Number(raw);
  return {
    preset,
    ...range,
    location: raw === 'all' ? 'all' : Number.isInteger(location) && location > 0 ? location : null,
  };
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    PeriodSelectorComponent,
    KpiCardComponent,
    TopProductsCardComponent,
    RecentOrdersCardComponent,
    SalesByDayChartComponent,
    BreakdownChartComponent,
    LowStockAlertComponent,
    ExpiryAlertComponent,
  ],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly metricsService = inject(GetDashboardMetricsService);
  private readonly locationsService = inject(GetAllBusinessLocationsService);
  private readonly $branchId = inject(WhoamiService).$branchId;

  readonly formatCurrency = formatCurrency;

  readonly $query = toSignal(this.route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.route.snapshot.queryParamMap),
  });
  readonly $metrics = this.metricsService.$metrics;
  readonly $isLoading = this.metricsService.$isLoading;
  readonly $hasError = computed(() => this.metricsService.$error() !== undefined);
  readonly $locations = computed(() => this.locationsService.$locations() ?? []);
  // Sucursal efectiva: la de la URL; si no hay, la asignada al usuario (si existe); si no, todas.
  readonly $locationId = computed<number | null>(() => {
    const { location } = this.$query();
    if (location === 'all') return null;
    if (location !== null) return location;
    const branchId = this.$branchId();
    return this.$locations().some((item) => item.id === branchId) ? branchId! : null;
  });
  // null mientras no se sabe la sucursal del usuario, para no cargar "todas" y luego saltar a la suya.
  readonly $filters = computed(() => {
    const { from, to, location } = this.$query();
    const resolving =
      location === null && (this.$branchId() === undefined || this.locationsService.$locations() === undefined);
    return resolving ? null : { dateFrom: from, dateTo: to, locationId: this.$locationId() ?? undefined };
  });

  // Encabezado: saludo según la hora, nombre del usuario y sucursal elegida.
  private readonly $whoami = inject(WhoamiService).$whoami;
  readonly $greeting = computed(() => {
    const hour = new Date().getHours();
    const salute = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const name = this.$whoami()?.user.name?.split(' ')[0];
    return name ? `${salute}, ${name}` : salute;
  });
  readonly $today = computed(() => {
    const label = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  });
  readonly $locationName = computed(
    () => this.$locations().find((location) => location.id === this.$locationId())?.name ?? 'Todas las sucursales',
  );

  // Alerta de stock: la sucursal elegida o, con "todas", el local recordado del inventario.
  private readonly inventoryLocationStore = inject(InventoryLocationStore);
  readonly $inventoryEnabled = inject(BusinessSettingsService).$inventoryEnabled;
  readonly $inventoryLocationId = computed(() => this.$locationId() ?? this.inventoryLocationStore.$locationId());
  readonly $inventoryLocationHint = computed(() => {
    const name = this.$locations().find((location) => location.id === this.$inventoryLocationId())?.name;
    return name ? `En ${name}` : 'En el local elegido';
  });

  readonly $comparison = computed(() => comparisonLabel(this.$query().preset));
  readonly $includesToday = computed(() => this.$query().to >= toDateKey(new Date()));

  // Datos de los gráficos de barras.
  readonly $categories = computed<BreakdownItem[]>(() =>
    (this.$metrics()?.salesByCategory ?? []).map((category) => ({
      label: category.categoryName ?? 'Sin categoría',
      value: category.revenue,
      detail: `${category.quantity} u`,
    })),
  );
  readonly $paymentMethods = computed<BreakdownItem[]>(() =>
    (this.$metrics()?.paymentsByMethod ?? []).map((payment) => ({
      label: paymentMethodLabel(payment.method),
      value: payment.amount,
      detail: `${payment.count} ${payment.count === 1 ? 'pago' : 'pagos'}`,
    })),
  );

  constructor() {
    // Se recarga al cambiar el período o la sucursal efectiva (incluida la del usuario al llegar).
    effect(() => {
      const filters = this.$filters();
      if (filters) untracked(() => this.metricsService.load(filters));
    });
  }

  ngOnInit(): void {
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.$includesToday()) this.metricsService.retry();
      });
  }

  handlePreset(preset: PeriodPreset) {
    this.navigate({ range: preset === 'today' ? null : preset, from: null, to: null });
  }

  handleCustom({ from, to }: { from: string; to: string }) {
    this.navigate({ range: 'custom', from, to });
  }

  handleLocation(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.navigate({ location: value || 'all' });
  }

  handleRetry() {
    this.metricsService.retry();
  }

  handleLowStock() {
    const locationId = this.$inventoryLocationId();
    if (locationId) this.inventoryLocationStore.select(locationId);
    this.router.navigate(['/inventory'], { queryParams: { low: 'true' } });
  }

  private navigate(queryParams: Record<string, string | null>) {
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
