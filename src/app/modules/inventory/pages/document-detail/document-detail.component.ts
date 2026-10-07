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
  formatQuantity,
  formatUnitCost,
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
  productLabel,
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
  // Solo transferencias.
  toLocationName: string | null;
  supplierName: string | null;
  referenceNo: string | null;
  notes: string | null;
  totalCost: number;
  createdBy: string | null;
  createdAt: string | null;
  // Compras que vienen de una orden de compra.
  purchaseOrderId: number | null;
  partial: boolean;
}>;

/** Una fila por ítem transferido: la salida del origen y la entrada al destino juntas. */
export type TransferLine = Readonly<{
  variationId: number;
  label: string;
  unitName: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  fromBalanceAfter: number | null;
  toBalanceAfter: number | null;
}>;

const BACK_LINKS: Record<InventoryDocumentType, { link: string; label: string }> = {
  purchase: { link: '/inventory/purchases', label: 'Compras' },
  adjustment: { link: '/inventory/adjustments', label: 'Ajustes' },
  count: { link: '/inventory/counts', label: 'Conteos' },
  transfer: { link: '/inventory/transfers', label: 'Transferencias' },
  production: { link: '/inventory/productions', label: 'Producción' },
};

/** Tipo del documento según sus movimientos (cuando no llega la cabecera). */
function typeFromMovements(movements: readonly StockMovementDto[]): InventoryDocumentType {
  const types = new Set(movements.map((movement) => movement.movementType));
  if (types.has('transfer_out') || types.has('transfer_in')) return 'transfer';
  if (types.has('count')) return 'count';
  if (types.has('purchase')) return 'purchase';
  if (types.has('production')) return 'production';
  return 'adjustment';
}

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
    toLocationName: document.toLocationName ?? null,
    supplierName: document.supplierName,
    referenceNo: document.referenceNo,
    notes: document.notes,
    totalCost: document.totalCost,
    createdBy: document.createdByName || document.createdBy,
    createdAt: document.createdAt,
    purchaseOrderId: document.purchaseOrderId ?? null,
    partial: false,
  };
}

function fromMovements(movements: readonly StockMovementDto[]): DocumentHeader | null {
  const first = movements[0];
  if (!first) return null;
  const type = typeFromMovements(movements);
  const exit = movements.find((movement) => movement.movementType === 'transfer_out');
  const entry = movements.find((movement) => movement.movementType === 'transfer_in');
  // En transferencias el costo es el de lo que salió (la entrada vale lo mismo); en producciones, lo producido.
  const costMovements =
    type === 'transfer'
      ? movements.filter((movement) => movement.movementType === 'transfer_out')
      : type === 'production'
        ? movements.filter((movement) => movement.quantity > 0)
        : movements;
  return {
    type,
    reason: null,
    date: formatDateTimeFull(first.createdAt),
    locationName: type === 'transfer' ? (exit?.locationName ?? '—') : first.locationName,
    toLocationName: type === 'transfer' ? (entry?.locationName ?? '—') : null,
    supplierName: null,
    referenceNo: null,
    notes: first.notes,
    totalCost: costMovements.reduce((total, movement) => total + Math.abs(movement.totalCost), 0),
    createdBy: first.createdByName || first.createdBy,
    createdAt: first.createdAt,
    purchaseOrderId: null,
    partial: true,
  };
}

/** Junta la salida y la entrada de cada ítem (los movimientos de una transferencia vienen de a pares). */
function toTransferLines(movements: readonly StockMovementDto[]): TransferLine[] {
  const lines = new Map<number, TransferLine>();
  for (const movement of movements) {
    if (movement.movementType !== 'transfer_out' && movement.movementType !== 'transfer_in') continue;
    const isExit = movement.movementType === 'transfer_out';
    const current = lines.get(movement.variationId);
    const base: TransferLine = current ?? {
      variationId: movement.variationId,
      label: productLabel(movement.productName, movement.variationName),
      unitName: movement.unitName,
      quantity: Math.abs(movement.quantity),
      unitCost: movement.unitCost,
      totalCost: Math.abs(movement.totalCost),
      fromBalanceAfter: null,
      toBalanceAfter: null,
    };
    lines.set(movement.variationId, {
      ...base,
      // El costo manda la salida (costo promedio del origen).
      ...(isExit ? { quantity: Math.abs(movement.quantity), unitCost: movement.unitCost, totalCost: Math.abs(movement.totalCost) } : {}),
      ...(isExit ? { fromBalanceAfter: movement.balanceAfter } : { toBalanceAfter: movement.balanceAfter }),
    });
  }
  return [...lines.values()];
}

/**
 * Detalle de un documento (compra, ajuste, conteo, transferencia o producción). No hay GET de un documento: las líneas
 * son los movimientos con ese documentId y la cabecera llega por el state de navegación o se busca en la
 * lista de documentos. Una transferencia muestra una fila por ítem (salida del origen + entrada al destino).
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
  readonly formatQuantity = formatQuantity;
  readonly formatUnitCost = formatUnitCost;

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
      const type = typeFromMovements(this.$lines());
      // En transferencias el filtro de local incluye origen y destino, así que sirve cualquiera de los dos.
      return { id: this.$id(), filters: { type, locationId: first.locationId } as InventoryDocumentFiltersDto };
    },
    stream: ({ params }) => this.#findDocument(params.id, params.filters, 1).pipe(catchError(() => of(null))),
  });

  readonly $isHeaderLoading = computed(() => this.movements.isLoading() || this.#searchedDocument.isLoading());
  readonly $header = computed<DocumentHeader | null>(() => {
    const document = this.$stateDocument() ?? this.#searchedDocument.value() ?? null;
    return document ? fromDocument(document) : fromMovements(this.$lines());
  });
  readonly #back = computed(() => {
    const type = this.$header()?.type;
    return type ? BACK_LINKS[type] : { link: '/inventory', label: 'Inventario' };
  });
  readonly $backLink = computed(() => this.#back().link);
  readonly $backLabel = computed(() => this.#back().label);

  // Producción: la entrada de la preparación y las salidas de sus insumos.
  readonly $producedLines = computed(() =>
    this.$header()?.type === 'production' ? this.$lines().filter((line) => line.quantity > 0) : [],
  );
  readonly $consumedLines = computed(() =>
    this.$header()?.type === 'production' ? this.$lines().filter((line) => line.quantity <= 0) : [],
  );
  readonly $transferLines = computed(() => (this.$header()?.type === 'transfer' ? toTransferLines(this.$lines()) : []));
  /** Conteo: + sobrante / − faltante, valorizado (el total del documento suma ambos en positivo). */
  readonly $netDifference = computed(() =>
    this.$lines().reduce((total, line) => total + Math.sign(line.quantity) * Math.abs(line.totalCost), 0),
  );
  readonly $totalLabel = computed(() => {
    const type = this.$header()?.type;
    return type === 'count' ? 'Valor ajustado' : type === 'transfer' || type === 'production' ? 'Costo total' : 'Total';
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
