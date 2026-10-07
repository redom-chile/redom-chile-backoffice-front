import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { HeaderDashboardComponent, IconComponent } from 'src/ui';
import { InventoryDocumentFiltersDto, InventoryLocationStore, InventoryService, isInventoryDisabledError } from '../../data-access';
import {
  DocumentFilters,
  DocumentsFiltersComponent,
  LoadErrorComponent,
  readDate,
  readId,
  readPage,
  resultError,
  resultValue,
  toRemoteResult,
} from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import { CountsTableComponent } from './ui';

const PER_PAGE = 20;

type CountListQuery = DocumentFilters & Readonly<{ page: number }>;

function toQuery(params: ParamMap): CountListQuery {
  return {
    page: readPage(params),
    locationId: readId(params, 'locationId'),
    reason: null,
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

/** Conteos físicos (documentos type=count) con filtros en la URL. */
@Component({
  selector: 'app-count-list',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    InventoryDisabledComponent,
    LoadErrorComponent,
    DocumentsFiltersComponent,
    CountsTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header-dashboard
      title="Conteos"
      subtitle="Toma de inventario: cuentas lo que hay en el local y el stock se corrige a lo contado. Las diferencias quedan valorizadas.">
      @if (!$isDisabled()) {
      <a
        routerLink="/inventory/counts/new"
        [queryParams]="$query().locationId ? { locationId: $query().locationId } : {}"
        class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90">
        <app-icon class="h-5 w-5">add</app-icon>
        <span class="hidden sm:inline">Nuevo conteo</span>
        <span class="sm:hidden">Nuevo</span>
      </a>
      }
    </app-header-dashboard>

    @if ($isDisabled()) {
    <app-inventory-disabled />
    } @else if ($error(); as error) {
    <app-inventory-load-error [error]="error" title="Error al cargar los conteos" (retry)="documents.reload()" />
    } @else {
    <div class="mb-4 flex items-start gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
      <app-icon class="h-4 w-4 shrink-0">info</app-icon>
      <span>
        Cada conteo deja el stock de los ítems contados igual a lo contado; los no contados no cambian. Solo las líneas con diferencia
        generan movimientos. "Valor ajustado" suma faltantes y sobrantes sin signo; el detalle muestra cada diferencia.
      </span>
    </div>

    <app-documents-filters
      [filters]="$query()"
      [locations]="locationStore.$locations()"
      [hasFilters]="$hasFilters()"
      (filtersChange)="handleFiltersChange($event)"
      (clear)="handleClearFilters()" />

    <app-counts-table
      [documents]="$page()?.data ?? []"
      [loading]="documents.isLoading()"
      [pagination]="$page()?.pagination ?? null"
      [hasFilters]="$hasFilters()"
      (pageChange)="handlePageChange($event)"
      (clearFilters)="handleClearFilters()" />
    }
  `,
})
export class CountListComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  readonly documents = rxResource({
    params: (): InventoryDocumentFiltersDto | undefined => {
      if (this.#isDisabledBySettings()) return undefined;
      const { page, locationId, from, to } = this.$query();
      return {
        type: 'count',
        page,
        perPage: PER_PAGE,
        locationId: locationId ?? undefined,
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
      };
    },
    stream: ({ params }) => this.#inventory.getDocuments(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.documents.value()));
  readonly $error = computed(() => resultError(this.documents.value()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));

  readonly $hasFilters = computed(() => {
    const { locationId, from, to } = this.$query();
    return locationId !== null || from !== null || to !== null;
  });

  handleFiltersChange(changes: Partial<DocumentFilters>) {
    const params: Record<string, string | null> = { page: null };
    if ('locationId' in changes) params['locationId'] = changes.locationId ? String(changes.locationId) : null;
    if ('from' in changes) params['from'] = changes.from ?? null;
    if ('to' in changes) params['to'] = changes.to ?? null;
    this.#navigate(params);
  }

  handleClearFilters() {
    this.#navigate({ page: null, locationId: null, from: null, to: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
