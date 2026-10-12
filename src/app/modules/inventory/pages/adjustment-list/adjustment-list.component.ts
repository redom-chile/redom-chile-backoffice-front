import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DocumentListComponent } from '../../shared';

/** Ajustes de stock (documentos type=adjustment): mermas, consumo interno, stock inicial, conteos. */
@Component({
  selector: 'app-adjustment-list',
  imports: [DocumentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-document-list type="adjustment" />`,
})
export class AdjustmentListComponent {}
