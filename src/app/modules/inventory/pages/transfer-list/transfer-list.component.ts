import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DocumentListComponent } from '../../shared';

/** Transferencias entre locales (documentos type=transfer). Con un solo local explica cómo crear otro. */
@Component({
  selector: 'app-transfer-list',
  imports: [DocumentListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-document-list type="transfer" />`,
})
export class TransferListComponent {}
