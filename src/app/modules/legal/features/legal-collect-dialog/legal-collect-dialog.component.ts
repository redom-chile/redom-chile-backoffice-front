import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { PendingDocumentDto, requiredAccepted } from 'src/app/core/services/legal';
import { ButtonComponent, ModalCardComponent, SlotDirective } from 'src/ui';
import { LegalDocumentChecklistComponent } from '../../ui';

export type LegalCollectDialogData = Readonly<{
  documents: readonly PendingDocumentDto[];
  title: string;
  description?: string;
  confirmLabel?: string;
}>;

/** Junta la aceptación antes de una acción que la envía (registro con Google): devuelve los versionId marcados. */
@Component({
  selector: 'app-legal-collect-dialog',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, LegalDocumentChecklistComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <div>
          <h2 id="legal-collect-title" class="text-foreground text-lg font-semibold sm:text-xl">{{ data.title }}</h2>
          @if (data.description) {
          <p class="text-muted-foreground text-sm">{{ data.description }}</p>
          }
        </div>
      </ng-template>
      <div class="p-2">
        <app-legal-document-checklist
          [documents]="data.documents"
          [(accepted)]="$accepted"
          [showErrors]="$submitted()" />
      </div>
      <ng-template app-slot="footer">
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <app-button type="button" impact="light" tone="primary" (buttonClick)="dialogRef.close()"
            >Cancelar</app-button
          >
          <app-button type="button" impact="bold" tone="primary" (buttonClick)="confirm()">{{
            data.confirmLabel ?? 'Aceptar y continuar'
          }}</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LegalCollectDialogComponent {
  readonly dialogRef = inject<MatDialogRef<LegalCollectDialogComponent, number[]>>(MatDialogRef);
  readonly data = inject<LegalCollectDialogData>(MAT_DIALOG_DATA);
  readonly $accepted = signal<readonly number[]>([]);
  readonly $submitted = signal(false);

  confirm() {
    this.$submitted.set(true);
    if (requiredAccepted(this.data.documents, this.$accepted())) this.dialogRef.close([...this.$accepted()]);
  }
}

export function openLegalCollectDialog(
  dialog: MatDialog,
  data: LegalCollectDialogData,
): Observable<number[] | undefined> {
  return dialog
    .open<LegalCollectDialogComponent, LegalCollectDialogData, number[]>(LegalCollectDialogComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true,
      ariaLabelledBy: 'legal-collect-title',
      data,
    })
    .afterClosed();
}
