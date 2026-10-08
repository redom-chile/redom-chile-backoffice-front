import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getPlatformErrorMessage, PlatformService, SubscriptionDetailDto } from '../../data-access';
import { BUSINESS_MODAL_CONFIG, BusinessModalData } from '../business-shared';

export type BusinessNotesModalData = BusinessModalData & Readonly<{ subscription: SubscriptionDetailDto }>;

const MAX_NOTES = 1000;

/** Nota interna de la suscripción (solo la ve el equipo de Redom). Devuelve true si guardó. */
@Component({
  selector: 'app-business-notes-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Nota interna</h2>
      </ng-template>

      <div class="p-2 text-sm">
        <label for="business-notes" class="mb-1 block font-medium">Nota</label>
        <textarea
          id="business-notes"
          rows="5"
          [attr.maxlength]="maxNotes"
          placeholder="Ej: Acordó pagar por transferencia los primeros 3 meses"
          class="glass-input w-full rounded-md px-3 py-2"
          [value]="$notes()"
          (input)="$notes.set($any($event.target).value)"></textarea>
        <div class="text-muted-foreground mt-1 flex justify-between gap-2 text-xs">
          <span>Solo la ve el equipo de Redom. Déjala vacía para borrarla.</span>
          <span class="tabular-nums">{{ $notes().length }}/{{ maxNotes }}</span>
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSaving()" (buttonClick)="dialogRef.close()">Cancelar</app-button>
          <app-button type="button" impact="bold" [disabled]="$isSaving()" [isLoading]="$isSaving()" (buttonClick)="handleSubmit()">Guardar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class BusinessNotesModalComponent {
  readonly dialogRef = inject<MatDialogRef<BusinessNotesModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<BusinessNotesModalData>(MAT_DIALOG_DATA);
  readonly #platform = inject(PlatformService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly maxNotes = MAX_NOTES;
  readonly $notes = signal(this.data.subscription.notes ?? '');
  readonly $isSaving = signal(false);

  handleSubmit() {
    if (this.$isSaving()) return;
    const notes = this.$notes().trim() || null;
    if (notes === (this.data.subscription.notes ?? null)) {
      this.dialogRef.close(false);
      return;
    }
    this.$isSaving.set(true);
    this.#platform
      .updateSubscription(this.data.businessId, { notes })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => {
          this.#toast.show(notes ? 'Nota guardada' : 'Nota borrada', 'success');
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.$isSaving.set(false);
          this.#toast.show(getPlatformErrorMessage(error, 'No se pudo guardar la nota'), 'error');
        },
      });
  }
}

export function openBusinessNotesModal(dialog: MatDialog, data: BusinessNotesModalData): Observable<boolean | undefined> {
  return dialog.open<BusinessNotesModalComponent, BusinessNotesModalData, boolean>(BusinessNotesModalComponent, { ...BUSINESS_MODAL_CONFIG, data }).afterClosed();
}
