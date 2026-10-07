import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import {
  ADJUSTMENT_REASON_LABELS,
  DOCUMENT_TYPE_LABELS,
  formatMoney,
  InventoryDocumentDto,
  InventoryDocumentType,
} from '../../../data-access';
import { formatDocumentDate } from '../../data-access';

const EMPTY_TITLES: Record<InventoryDocumentType, string> = {
  purchase: 'Sin compras',
  adjustment: 'Sin ajustes',
  count: 'Sin conteos',
  transfer: 'Sin transferencias',
  production: 'Sin producciones',
};

/** "Casa matriz → Sucursal 2" en transferencias; el local en el resto. */
export function documentLocationLabel(document: InventoryDocumentDto): string {
  if (document.type !== 'transfer') return document.locationName;
  return `${document.locationName} → ${document.toLocationName ?? '—'}`;
}

/** linesCount cuenta movimientos: una transferencia genera 2 por ítem (salida y entrada). */
export function documentItemsCount(document: InventoryDocumentDto): number {
  return document.type === 'transfer' ? Math.ceil(document.linesCount / 2) : document.linesCount;
}

export function documentItemsLabel(document: InventoryDocumentDto): string {
  const count = documentItemsCount(document);
  if (document.type === 'count') return `${count} con diferencia`;
  if (document.type === 'transfer') return `${count} ${count === 1 ? 'ítem' : 'ítems'}`;
  return `${count} ${count === 1 ? 'línea' : 'líneas'}`;
}

/**
 * Tabla de documentos de inventario (compras, ajustes, conteos o transferencias; sin type, mezclados).
 * En móvil se muestran tarjetas. Al abrir un documento se pasa por el state de navegación para que
 * el detalle tenga la cabecera.
 */
@Component({
  selector: 'app-documents-table',
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents-table.component.html',
})
export class DocumentsTableComponent {
  readonly #router = inject(Router);

  // null: documentos de varios tipos (se agrega la columna Tipo).
  readonly type = input<InventoryDocumentType | null>(null);
  readonly documents = input.required<readonly InventoryDocumentDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly hasFilters = input(false);
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly reasonLabels = ADJUSTMENT_REASON_LABELS;
  readonly typeLabels = DOCUMENT_TYPE_LABELS;
  readonly formatMoney = formatMoney;
  readonly formatDate = formatDocumentDate;
  readonly locationLabel = documentLocationLabel;
  readonly itemsCount = documentItemsCount;
  readonly itemsLabel = documentItemsLabel;

  readonly $emptyTitle = computed(() => {
    const type = this.type();
    return type ? EMPTY_TITLES[type] : 'Sin documentos';
  });

  readonly $headers = computed(() => {
    switch (this.type()) {
      case 'transfer':
        return { location: 'Origen → Destino', lines: 'Ítems', total: 'Costo total' };
      case 'count':
        return { location: 'Local', lines: 'Con diferencia', total: 'Valor ajustado' };
      default:
        return { location: 'Local', lines: 'Líneas', total: 'Total' };
    }
  });

  /** Título de la tarjeta en móvil. */
  title(document: InventoryDocumentDto): string {
    switch (document.type) {
      case 'purchase':
        return document.supplierName ?? 'Sin proveedor';
      case 'adjustment':
        return document.reason ? this.reasonLabels[document.reason] : 'Ajuste';
      case 'transfer':
        return documentLocationLabel(document);
      default:
        return this.typeLabels[document.type] ?? document.type;
    }
  }

  userLabel(document: InventoryDocumentDto): string {
    return document.createdByName || document.createdBy || '—';
  }

  open(document: InventoryDocumentDto) {
    this.#router.navigate(['/inventory/documents', document.id], { state: { document } });
  }
}
