import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { getLegalErrorMessage, PlatformLegalService } from '../../data-access';

export type LegalNotifyModalData = Readonly<{ versionId: number; label: string }>;

type NotifyTotals = Readonly<{ sent: number; failed: number; remaining: number; rounds: number }>;

/** Avisa por correo a quienes faltan por aceptar (de a 200). Se puede seguir mientras quede alguien. Devuelve true si envió algo. */
@Component({
  selector: 'app-legal-notify-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Avisar a quienes faltan</h2>
      </ng-template>

      <div class="space-y-3 p-2 text-sm">
        <p class="text-foreground">{{ data.label }}</p>
        <p class="text-muted-foreground">
          Envía un correo a quienes todavía no aceptan la versión vigente, hasta 200 por envío. Cada correo recibe el aviso una sola vez.
          Si no lo haces, el sistema avisa solo cada día cuando una versión con cambio material entra en vigencia.
        </p>
        @if ($totals(); as totals) {
          <dl class="glass grid grid-cols-3 gap-2 rounded-lg p-3 text-center">
            <div>
              <dt class="text-muted-foreground text-xs">Enviados</dt>
              <dd class="text-foreground text-lg font-semibold tabular-nums">{{ totals.sent }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">Fallidos</dt>
              <dd class="text-lg font-semibold tabular-nums" [class]="totals.failed ? 'text-red-600 dark:text-red-400' : 'text-foreground'">{{ totals.failed }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground text-xs">Quedan</dt>
              <dd class="text-foreground text-lg font-semibold tabular-nums">{{ totals.remaining }}</dd>
            </div>
          </dl>
          <p class="text-muted-foreground text-xs">
            @if (totals.remaining > 0) {
              Quedan correos por enviar (incluye los fallidos): puedes continuar.
            } @else {
              Listo: no queda nadie por avisar.
            }
          </p>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end gap-3">
          <app-button type="button" impact="light" [disabled]="$isSending()" (buttonClick)="close()">{{ $totals() ? 'Cerrar' : 'Cancelar' }}</app-button>
          @if (!$totals() || $totals()!.remaining > 0) {
            <app-button type="button" impact="bold" [disabled]="$isSending()" [isLoading]="$isSending()" (buttonClick)="handleSend()">
              {{ $totals() ? 'Continuar' : 'Enviar avisos' }}
            </app-button>
          }
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LegalNotifyModalComponent {
  readonly dialogRef = inject<MatDialogRef<LegalNotifyModalComponent, boolean>>(MatDialogRef);
  readonly data = inject<LegalNotifyModalData>(MAT_DIALOG_DATA);
  readonly #legal = inject(PlatformLegalService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly $isSending = signal(false);
  readonly $totals = signal<NotifyTotals | null>(null);

  handleSend() {
    if (this.$isSending()) return;
    this.$isSending.set(true);
    this.#legal
      .notifyVersion(this.data.versionId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.$isSending.set(false);
          const previous = this.$totals();
          this.$totals.set({
            sent: (previous?.sent ?? 0) + result.sent,
            // Los fallidos se reintentan en el siguiente envío: se muestran los de la última vuelta.
            failed: result.failed,
            remaining: result.remaining,
            rounds: (previous?.rounds ?? 0) + 1,
          });
          if (!result.sent && !result.failed && !result.remaining) this.#toast.show('No había nadie por avisar', 'success');
        },
        error: (error: unknown) => {
          this.$isSending.set(false);
          this.#toast.show(getLegalErrorMessage(error, 'No se pudieron enviar los avisos'), 'error');
        },
      });
  }

  close() {
    this.dialogRef.close((this.$totals()?.sent ?? 0) > 0);
  }
}

export function openLegalNotifyModal(dialog: MatDialog, data: LegalNotifyModalData): Observable<boolean | undefined> {
  return dialog
    .open<LegalNotifyModalComponent, LegalNotifyModalData, boolean>(LegalNotifyModalComponent, { width: '480px', maxWidth: '95vw', disableClose: true, data })
    .afterClosed();
}
