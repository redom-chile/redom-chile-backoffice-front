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
 * Lista de documentos de inventario (compras o ajustes) con filtros en la URL.
 * La usan las páginas de compras y de ajustes.
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
      @if (!$isDisabled()) {
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

  readonly $texts = computed(() =>
    this.type() === 'purchase'
      ? {
          title: 'Compras',
          subtitle: 'Facturas y boletas de proveedores. Cada compra suma stock y actualiza el costo promedio.',
          newLabel: 'Nueva compra',
          newLink: '/inventory/purchases/new',
          errorTitle: 'Error al cargar las compras',
        }
      : {
          title: 'Ajustes',
          subtitle: 'Mermas, consumo interno, stock inicial y correcciones por conteo.',
          newLabel: 'Nuevo ajuste',
          newLink: '/inventory/adjustments/new',
          errorTitle: 'Error al cargar los ajustes',
        },
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
