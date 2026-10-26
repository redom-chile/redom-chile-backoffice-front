import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PendingDocumentDto } from 'src/app/core/services/legal';
import { ModalCardComponent, SlotDirective } from 'src/ui';
import { LegalAcceptPanelComponent } from '../legal-accept-panel/legal-accept-panel.component';

export type LegalAcceptanceDialogData = Readonly<{ documents: readonly PendingDocumentDto[] }>;

/** Bloqueo por documentos pendientes (428): no se cierra hasta aceptar o cerrar sesión. true = aceptó. */
@Component({
  selector: 'app-legal-acceptance-dialog',
  imports: [ModalCardComponent, SlotDirective, LegalAcceptPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <div>
          <h2 id="legal-acceptance-title" class="text-foreground text-lg font-semibold sm:text-xl">Antes de seguir</h2>
          <p class="text-muted-foreground text-sm">
            Actualizamos nuestros documentos legales. Léelos y acéptalos para seguir usando Redom.
          </p>
        </div>
      </ng-template>
      <div class="p-2">
        <app-legal-accept-panel
          [documents]="data.documents"
          (done)="dialogRef.close(true)"
          (loggedOut)="dialogRef.close(false)" />
      </div>
    </app-modal-card>
  `,
})
export class LegalAcceptanceDialogComponent {
  readonly dialogRef = inject<MatDialogRef<LegalAcceptanceDialogComponent, boolean>>(MatDialogRef);
  readonly data = inject<LegalAcceptanceDialogData>(MAT_DIALOG_DATA);
}

export function openLegalAcceptanceDialog(dialog: MatDialog, data: LegalAcceptanceDialogData) {
  return dialog.open<LegalAcceptanceDialogComponent, LegalAcceptanceDialogData, boolean>(
    LegalAcceptanceDialogComponent,
    {
      width: '560px',
      maxWidth: '95vw',
      disableClose: true,
      closeOnNavigation: false,
      ariaLabelledBy: 'legal-acceptance-title',
      data,
    },
  );
}
