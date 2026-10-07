import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { HeaderDashboardComponent, IconComponent } from 'src/ui';
import {
  ADJUSTMENT_REASONS,
  AdjustmentReason,
  InventoryDocumentFiltersDto,
  InventoryDocumentType,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
} from '../../../data-access';
import { InventoryDisabledComponent } from '../../../ui';
import { readDate, readId, readOption, readPage, resultError, resultValue, toRemoteResult } from '../../data-access';
import { DocumentFilters, DocumentsFiltersComponent, LoadErrorComponent } from '../../ui';
import { DocumentsTableComponent } from '../documents-table';

const PER_PAGE = 20;
const REASONS = ADJUSTMENT_REASONS.map((reason) => reason.value);

type ListTexts = Readonly<{
  title: string;
  subtitle: string;
  newLabel: string;
  newLink: string;
  errorTitle: string;
}>;

const LIST_TEXTS: Record<InventoryDocumentType, ListTexts> = {
  purchase: {
    title: 'Compras',
    subtitle: 'Facturas y boletas de proveedores. Cada compra suma stock y actualiza el costo promedio.',
    newLabel: 'Nueva compra',
    newLink: '/inventory/purchases/new',
    errorTitle: 'Error al cargar las compras',
  },
  adjustment: {
    title: 'Ajustes',
    subtitle: 'Mermas, consumo interno, stock inicial y correcciones por conteo.',
    newLabel: 'Nuevo ajuste',
    newLink: '/inventory/adjustments/new',
    errorTitle: 'Error al cargar los ajustes',
  },
  count: {
    title: 'Conteos',
    subtitle: 'Conteos físicos del stock. Cada conteo corrige el sistema con lo que realmente hay.',
    newLabel: 'Nuevo conteo',
    newLink: '/inventory/counts/new',
    errorTitle: 'Error al cargar los conteos',
  },
  transfer: {
    title: 'Transferencias',
    subtitle: 'Stock enviado entre locales. Sale del origen a su costo promedio y entra al destino a ese mismo costo.',
    newLabel: 'Nueva transferencia',
    newLink: '/inventory/transfers/new',
    errorTitle: 'Error al cargar las transferencias',
  },
  production: {
    title: 'Producciones',
    subtitle: 'Preparaciones que consumen ingredientes y suman stock del producto preparado.',
    newLabel: 'Nueva producción',
    newLink: '/inventory/productions/new',
    errorTitle: 'Error al cargar las producciones',
  },
};

type DocumentListQuery = DocumentFilters & Readonly<{ page: number }>;

function toQuery(params: ParamMap): DocumentListQuery {
  return {
    page: readPage(params),
    locationId: readId(params, 'locationId'),
    reason: readOption<AdjustmentReason>(params, 'reason', REASONS),
    from: readDate(params, 'from'),
    to: readDate(params, 'to'),
  };
}

/**
 * Lista de documentos de inventario de un tipo (compras, ajustes, conteos, transferencias) con filtros en la URL.
 * En transferencias el filtro de local incluye las que salen y las que llegan.
 */
@Component({
  selector: 'app-document-list',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    IconComponent,
    InventoryDisabledComponent,
    LoadErrorComponent,
    DocumentsFiltersComponent,
    DocumentsTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header-dashboard [title]="$texts().title" [subtitle]="$texts().subtitle">
      @if (!$isDisabled() && !$needsMoreLocations()) {
      <a
        [routerLink]="$texts().newLink"
        class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90">
        <app-icon class="h-5 w-5">add</app-icon>
        <span class="hidden sm:inline">{{ $texts().newLabel }}</span>
        <span class="sm:hidden">Nuevo</span>
      </a>
      }
    </app-header-dashboard>

    @if ($isDisabled()) {
    <app-inventory-disabled />
    } @else if ($error(); as error) {
    <app-inventory-load-error [error]="error" [title]="$texts().errorTitle" (retry)="documents.reload()" />
    } @else {
    @if ($needsMoreLocations()) {
    <div class="glass mb-4 flex flex-col gap-3 rounded-[1rem] p-4 sm:flex-row sm:items-center">
      <app-icon class="text-primary h-6 w-6 shrink-0" aria-hidden="true">storefront</app-icon>
      <div class="min-w-0 flex-1">
        <p class="text-foreground text-sm font-semibold">Necesitas al menos dos locales</p>
        <p class="text-muted-foreground text-sm">
          Las transferencias mueven stock de un local a otro. Crea otra sucursal para empezar a transferir.
        </p>
      </div>
      <a
        routerLink="/business/location"
        class="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-semibold hover:underline">
        Negocio → Sucursales
        <app-icon class="h-4 w-4">arrow_forward</app-icon>
      </a>
    </div>
    }
    <app-documents-filters
      [filters]="$query()"
      [locations]="locationStore.$locations()"
      [showReason]="type() === 'adjustment'"
      [hasFilters]="$hasFilters()"
      (filtersChange)="handleFiltersChange($event)"
      (clear)="handleClearFilters()" />

    <app-documents-table
      [type]="type()"
      [documents]="$page()?.data ?? []"
      [loading]="documents.isLoading()"
      [pagination]="$page()?.pagination ?? null"
      [hasFilters]="$hasFilters()"
      (pageChange)="handlePageChange($event)"
      (clearFilters)="handleClearFilters()" />
    }
  `,
})
export class DocumentListComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly type = input.required<InventoryDocumentType>();

  readonly $query = toSignal(this.#route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.#route.snapshot.queryParamMap),
  });
  readonly $isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());

  readonly $texts = computed(() => LIST_TEXTS[this.type()]);

  // Transferir requiere al menos dos locales; mientras cargan no se muestra el aviso.
  readonly $needsMoreLocations = computed(
    () =>
      this.type() === 'transfer' &&
      !this.locationStore.$isLoading() &&
      !this.locationStore.$hasError() &&
      this.locationStore.$locations().length < 2,
  );

  readonly documents = rxResource({
    params: (): InventoryDocumentFiltersDto | undefined => {
      if (this.$isDisabledBySettings()) return undefined;
      const { page, locationId, reason, from, to } = this.$query();
      const type = this.type();
      return {
        type,
        page,
        perPage: PER_PAGE,
        locationId: locationId ?? undefined,
        reason: type === 'adjustment' ? (reason ?? undefined) : undefined,
        dateFrom: from ?? undefined,
        dateTo: to ?? undefined,
      };
    },
    stream: ({ params }) => this.#inventory.getDocuments(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.documents.value()));
  readonly $error = computed(() => resultError(this.documents.value()));
  // Inventario apagado (por configuración o por el 409 del backend): solo la pantalla "Activar inventario".
  readonly $isDisabled = computed(() => this.$isDisabledBySettings() || isInventoryDisabledError(this.$error()));

  readonly $hasFilters = computed(() => {
    const { locationId, reason, from, to } = this.$query();
    return locationId !== null || (this.type() === 'adjustment' && reason !== null) || from !== null || to !== null;
  });

  handleFiltersChange(changes: Partial<DocumentFilters>) {
    const params: Record<string, string | null> = { page: null };
    if ('locationId' in changes) params['locationId'] = changes.locationId ? String(changes.locationId) : null;
    if ('reason' in changes) params['reason'] = changes.reason ?? null;
    if ('from' in changes) params['from'] = changes.from ?? null;
    if ('to' in changes) params['to'] = changes.to ?? null;
    this.#navigate(params);
  }

  handleClearFilters() {
    this.#navigate({ page: null, locationId: null, reason: null, from: null, to: null });
  }

  handlePageChange(page: number) {
    this.#navigate({ page: page > 1 ? String(page) : null });
  }

  #navigate(queryParams: Record<string, string | null>) {
    this.#router.navigate([], { relativeTo: this.#route, queryParams, queryParamsHandling: 'merge' });
  }
}
