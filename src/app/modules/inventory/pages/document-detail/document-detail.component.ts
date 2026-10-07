import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { IconComponent, SkeletonComponent } from 'src/ui';
import {
  ADJUSTMENT_REASON_LABELS,
  DOCUMENT_TYPE_LABELS,
  formatMoney,
  InventoryDocumentDto,
  InventoryDocumentFiltersDto,
  InventoryDocumentType,
  InventoryService,
  isInventoryDisabledError,
  StockMovementDto,
} from '../../data-access';
import { InventoryDisabledComponent } from '../../ui';
import {
  formatDateTimeFull,
  formatDocumentDate,
  LoadErrorComponent,
  MovementsTableComponent,
  resultError,
  resultValue,
  toRemoteResult,
} from '../../shared';

// Las líneas de un documento caben en una página (el backend permite hasta 100).
const LINES_PER_PAGE = 100;
// Para encontrar la cabecera se recorren a lo más estas páginas de documentos del mismo local y tipo.
const MAX_SEARCH_PAGES = 5;

/** Cabecera a mostrar: la real o una derivada de los movimientos si no se encontró el documento. */
type DocumentHeader = Readonly<{
  type: InventoryDocumentType;
  reason: string | null;
  date: string;
  locationName: string;
  supplierName: string | null;
  referenceNo: string | null;
  notes: string | null;
  totalCost: number;
  createdBy: string | null;
  createdAt: string | null;
  partial: boolean;
}>;

function readStateDocument(id: number): InventoryDocumentDto | null {
  try {
    const document = (history.state as { document?: InventoryDocumentDto } | null)?.document;
    return document && document.id === id ? document : null;
  } catch {
    return null;
  }
}

function fromDocument(document: InventoryDocumentDto): DocumentHeader {
  return {
    type: document.type,
    reason: document.reason ? ADJUSTMENT_REASON_LABELS[document.reason] : null,
    date: formatDocumentDate(document.documentDate),
    locationName: document.locationName,
    supplierName: document.supplierName,
    referenceNo: document.referenceNo,
    notes: document.notes,
    totalCost: document.totalCost,
    createdBy: document.createdBy,
    createdAt: document.createdAt,
    partial: false,
  };
}

function fromMovements(movements: readonly StockMovementDto[]): DocumentHeader | null {
  const first = movements[0];
  if (!first) return null;
  return {
    type: movements.some((movement) => movement.movementType === 'purchase') ? 'purchase' : 'adjustment',
    reason: null,
    date: formatDateTimeFull(first.createdAt),
    locationName: first.locationName,
    supplierName: null,
    referenceNo: null,
    notes: first.notes,
    totalCost: movements.reduce((total, movement) => total + Math.abs(movement.totalCost), 0),
    createdBy: first.createdBy,
    createdAt: first.createdAt,
    partial: true,
  };
}

/**
 * Detalle de una compra o ajuste. No hay GET de un documento: las líneas son los movimientos con ese
 * documentId y la cabecera llega por el state de navegación o se busca en la lista de documentos.
 */
@Component({
  selector: 'app-document-detail',
  imports: [RouterLink, IconComponent, SkeletonComponent, InventoryDisabledComponent, LoadErrorComponent, MovementsTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-detail.component.html',
})
export class DocumentDetailComponent {
  readonly #route = inject(ActivatedRoute);
  readonly #inventory = inject(InventoryService);
  readonly #settings = inject(BusinessSettingsService);

  readonly typeLabels = DOCUMENT_TYPE_LABELS;
  readonly formatMoney = formatMoney;
  readonly formatDateTime = formatDateTimeFull;

  readonly $id = toSignal(this.#route.paramMap.pipe(map((params) => Number(params.get('id')))), {
    initialValue: Number(this.#route.snapshot.paramMap.get('id')),
  });
  readonly $isValidId = computed(() => Number.isInteger(this.$id()) && this.$id() > 0);
  readonly #isDisabledBySettings = computed(() => this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled());
  readonly $stateDocument = computed(() => readStateDocument(this.$id()));

  readonly movements = rxResource({
    params: () => (this.$isValidId() && !this.#isDisabledBySettings() ? { documentId: this.$id(), perPage: LINES_PER_PAGE } : undefined),
    stream: ({ params }) => this.#inventory.getMovements(params).pipe(toRemoteResult()),
  });

  readonly $page = computed(() => resultValue(this.movements.value()));
  readonly $lines = computed(() => this.$page()?.data ?? []);
  readonly $error = computed(() => resultError(this.movements.value()));
  readonly $isDisabled = computed(() => this.#isDisabledBySettings() || isInventoryDisabledError(this.$error()));

  // Sin state de navegación (ej. al llegar desde el kardex o recargar), se busca la cabecera.
  readonly #searchedDocument = rxResource({
    params: () => {
      if (this.$stateDocument()) return undefined;
      const first = this.$lines()[0];
      if (!first) return undefined;
      const type: InventoryDocumentType = this.$lines().some((line) => line.movementType === 'purchase') ? 'purchase' : 'adjustment';
      return { id: this.$id(), filters: { type, locationId: first.locationId } as InventoryDocumentFiltersDto };
    },
    stream: ({ params }) => this.#findDocument(params.id, params.filters, 1).pipe(catchError(() => of(null))),
  });

  readonly $isHeaderLoading = computed(() => this.movements.isLoading() || this.#searchedDocument.isLoading());
  readonly $header = computed<DocumentHeader | null>(() => {
    const document = this.$stateDocument() ?? this.#searchedDocument.value() ?? null;
    return document ? fromDocument(document) : fromMovements(this.$lines());
  });
  readonly $backLink = computed(() => {
    const type = this.$header()?.type;
    return type === 'purchase' ? '/inventory/purchases' : type === 'adjustment' ? '/inventory/adjustments' : '/inventory';
  });
  readonly $backLabel = computed(() => {
    const type = this.$header()?.type;
    return type === 'purchase' ? 'Compras' : type === 'adjustment' ? 'Ajustes' : 'Inventario';
  });
  readonly $hasMoreLines = computed(() => (this.$page()?.pagination.totalItems ?? 0) > LINES_PER_PAGE);

  #findDocument(id: number, filters: InventoryDocumentFiltersDto, page: number): Observable<InventoryDocumentDto | null> {
    return this.#inventory.getDocuments({ ...filters, page, perPage: 100 }).pipe(
      switchMap((response) => {
        const found = response.data.find((document) => document.id === id);
        if (found) return of(found);
        if (page >= Math.min(response.pagination.totalPages, MAX_SEARCH_PAGES)) return of(null);
        return this.#findDocument(id, filters, page + 1);
      }),
    );
  }
}
