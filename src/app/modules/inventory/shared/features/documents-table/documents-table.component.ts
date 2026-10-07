import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PaginationMeta } from 'src/app/core/standarized-response';
import { IconComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { ADJUSTMENT_REASON_LABELS, formatMoney, InventoryDocumentDto, InventoryDocumentType } from '../../../data-access';
import { formatDocumentDate } from '../../data-access';

/**
 * Tabla de documentos de inventario (compras o ajustes). En móvil se muestran tarjetas.
 * Al abrir un documento se pasa por el state de navegación para que el detalle tenga la cabecera.
 */
@Component({
  selector: 'app-documents-table',
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents-table.component.html',
})
export class DocumentsTableComponent {
  readonly #router = inject(Router);

  readonly type = input.required<InventoryDocumentType>();
  readonly documents = input.required<readonly InventoryDocumentDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly hasFilters = input(false);
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly reasonLabels = ADJUSTMENT_REASON_LABELS;
  readonly formatMoney = formatMoney;
  readonly formatDate = formatDocumentDate;

  open(document: InventoryDocumentDto) {
    this.#router.navigate(['/inventory/documents', document.id], { state: { document } });
  }
}
