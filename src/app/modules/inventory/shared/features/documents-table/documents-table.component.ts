import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import {
  ADJUSTMENT_REASON_LABELS,
  DOCUMENT_TYPE_LABELS,
  formatMoney,
  InventoryDocumentDto,
  InventoryDocumentType,
  todayIsoDate,
} from '../../../data-access';
import { formatDocumentDate } from '../../data-access';

export type PurchasePaymentStatus = 'pending' | 'partial' | 'paid';

export const PURCHASE_PAYMENT_LABELS: Record<PurchasePaymentStatus, string> = {
  pending: 'Pendiente',
  partial: 'Parcial',
  paid: 'Pagada',
};

export const PURCHASE_PAYMENT_CLASSES: Record<PurchasePaymentStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  partial: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  paid: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

type PurchasePaymentFields = Pick<InventoryDocumentDto, 'totalCost' | 'vatAmount' | 'paymentStatus' | 'dueDate'>;

/** Neto + IVA de la factura (lo que se le debe al proveedor). */
export function purchaseGrossTotal(document: Pick<InventoryDocumentDto, 'totalCost' | 'vatAmount'>): number {
  return Number(document.totalCost ?? 0) + Number(document.vatAmount ?? 0);
}

/** Vencida: con fecha pasada y sin pagar del todo. */
export function isPurchaseOverdue(document: PurchasePaymentFields, today = todayIsoDate()): boolean {
  return !!document.dueDate && document.paymentStatus !== 'paid' && document.dueDate.slice(0, 10) < today;
}

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
  imports: [RouterLink, NgTemplateOutlet, IconComponent, SkeletonComponent, PaginationTableComponent],
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
  readonly grossTotal = purchaseGrossTotal;
  readonly today = todayIsoDate();

  paymentLabel(document: InventoryDocumentDto): string {
    return document.paymentStatus ? PURCHASE_PAYMENT_LABELS[document.paymentStatus] : '';
  }

  paymentClass(document: InventoryDocumentDto): string {
    return document.paymentStatus ? PURCHASE_PAYMENT_CLASSES[document.paymentStatus] : '';
  }

  isOverdue(document: InventoryDocumentDto): boolean {
    return isPurchaseOverdue(document, this.today);
  }

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
      case 'production':
        return { location: 'Local', lines: 'Movimientos', total: 'Costo total' };
      case 'purchase':
        return { location: 'Local', lines: 'Líneas', total: 'Total con IVA' };
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
      case 'production':
        return document.notes || 'Producción';
      default:
        return this.typeLabels[document.type] ?? document.type;
    }
  }

  /** Sin tipo fijo el título ya dice qué es en conteos y producciones. */
  showTypePrefix(document: InventoryDocumentDto): boolean {
    return !this.type() && document.type !== 'count' && document.type !== 'production';
  }

  userLabel(document: InventoryDocumentDto): string {
    return document.createdByName || document.createdBy || '—';
  }

  open(document: InventoryDocumentDto) {
    this.#router.navigate(['/inventory/documents', document.id], { state: { document } });
  }
}
