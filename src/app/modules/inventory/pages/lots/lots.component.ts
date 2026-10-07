import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { HeaderDashboardComponent, IconComponent, SkeletonComponent } from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  formatUnitCost,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  LotStatusFilter,
  StockLotDto,
  StockLotFiltersDto,
} from '../../data-access';
import { InventoryDisabledComponent } from '../../ui';
import {
  EXPIRY_DAYS_OPTIONS,
  expiryDistanceLabel,
  formatDocumentDate,
  LoadErrorComponent,
  LOT_STATUS_LABELS,
  LOT_STATUS_TONES,
  readExpiryDays,
  readId,
  readOption,
  resultError,
  resultValue,
  saveExpiryDays,
  toRemoteResult,
  wasteLinkParams,
} from '../../shared';

const STATUSES: readonly LotStatusFilter[] = ['active', 'expiring', 'expired'];

const LOT_STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: LotStatusFilter; label: string }> = [
  { value: 'active', label: 'Activos' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'expired', label: 'Vencidos' },
];

type LotsQuery = Readonly<{
  locationId: number | null;
  variationId: number | null;
  status: LotStatusFilter;
  days: number;
}>;

function readDays(params: ParamMap): number {
  const days = Number(params.get('days'));
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : readExpiryDays();
}

function toQuery(params: ParamMap): LotsQuery {
  return {
    locationId: readId(params, 'locationId'),
    variationId: readId(params, 'variationId'),
    status: readOption<LotStatusFilter>(params, 'status', STATUSES) ?? 'active',
    days: readDays(params),
  };
}

/**
 * Lotes con saldo, el que vence antes primero. Filtros en la URL: locationId (sin él, todos los locales),
 * status (active · expiring · expired), days (anticipación de "por vencer") y variationId.
 */
@Component({
  selector: 'app-lots',
  imports: [RouterLink, HeaderDashboardComponent, IconComponent, SkeletonComponent, InventoryDisabledComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lots.component.html',
})
export class LotsComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly statusOptions = LOT_STATUS_FILTER_OPTIONS;
  protected readonly statusLabels = LOT_STATUS_LABELS;
  protected readonly statusTones = LOT_STATUS_TONES;
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatUnitCost = formatUnitCost;
  protected readonly formatDate = formatDocumentDate;
  protected readonly distanceLabel = expiryDistanceLabel;
  protected readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  // Los días del URL se suman a las opciones si no están (ej. ?days=10).
  readonly $daysOptions = computed(() => {
    const days = this.$query().days;
    const options: number[] = [...EXPIRY_DAYS_OPTIONS];
    return options.includes(days) ? options : [...options, days].sort((a, b) => a - b);
  });

  readonly lots = rxResource({
    params: (): StockLotFiltersDto | undefined => {
      if (this.#isDisabledBySettings()) return undefined;
      const { locationId, variationId, status, days } = this.$query();
      return {
        status,
        days,
        locationId: locationId ?? undefined,
        variationId: variationId ?? undefined,
      };
    },
    stream: ({ params }) => this.#inventory.getLots(params).pipe(toRemoteResult()),
  });

  readonly $lots = computed(() => resultValue(this.lots.value()) ?? []);
  readonly $error = computed(() => resultError(this.lots.value()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));
  readonly $totalValue = computed(() => this.$lots().reduce((total, lot) => total + Number(lot.value ?? 0), 0));
  readonly $showLocation = computed(() => this.$query().locationId === null);

  /** Chip "Ítem: X": el nombre sale del primer lote. */
  readonly $itemChip = computed(() => {
    const { variationId } = this.$query();
    if (!variationId) return null;
    return this.$lots()[0]?.itemName ?? `Ítem #${variationId}`;
  });

  readonly $hasFilters = computed(() => {
    const { locationId, variationId, status } = this.$query();
    return locationId !== null || variationId !== null || status !== 'active';
  });

  readonly $emptyText = computed(() => {
    switch (this.$query().status) {
      case 'expiring':
        return `No hay lotes que venzan en los próximos ${this.$query().days} días.`;
      case 'expired':
        return 'No hay lotes vencidos con saldo.';
      default:
        return 'Aún no hay lotes con saldo. Anota el lote y el vencimiento al registrar una compra o stock inicial.';
    }
  });

  onLocation(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.#navigate({ locationId: value > 0 ? String(value) : null });
  }

  onStatus(status: LotStatusFilter) {
    this.#navigate({ status: status === 'active' ? null : status });
  }

  onDays(event: Event) {
    const days = Number((event.target as HTMLSelectElement).value);
    saveExpiryDays(days);
    this.#navigate({ days: String(days) });
  }

  removeItem() {
    this.#navigate({ variationId: null });
  }

  clearFilters() {
    this.#navigate({ locationId: null, variationId: null, status: null });
  }

  quantityLabel(lot: StockLotDto, value: number): string {
    return formatQuantity(value, lot.unitName);
  }

  wasteParams(lot: StockLotDto) {
    return wasteLinkParams(lot.variationId, lot.locationId);
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
