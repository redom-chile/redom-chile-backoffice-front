import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DocumentListComponent } from '../../shared';

/** Compras a proveedores (documentos type=purchase). */
@Component({
  selector: 'app-purchase-list',
  imports: [DocumentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-document-list type="purchase" />`,
})
export class PurchaseListComponent {}
