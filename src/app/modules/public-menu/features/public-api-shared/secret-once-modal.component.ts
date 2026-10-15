import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { copyToClipboard } from './public-api-format';

export type SecretOnceModalData = Readonly<{
  title: string;
  /** La llave o el secreto completo: solo vive mientras el modal está abierto. */
  secret: string;
  description: string;
  warning?: string;
  /** "el secreto" (masculino) o "la llave" (por defecto). */
  masculine?: boolean;
}>;

/** Muestra una llave o un secreto una sola vez. No se guarda en ningún lado: se borra al cerrar. */
@Component({
  selector: 'app-secret-once-modal',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">{{ data.title }}</h2>
      </ng-template>

      <div class="space-y-4 p-2">
        <p class="text-muted-foreground text-sm">{{ data.description }}</p>
        <div class="glass-input flex items-center gap-2 rounded-lg p-2">
          <code class="text-foreground min-w-0 flex-1 font-mono text-sm break-all select-all" data-testid="secret-value">{{ $secret() }}</code>
          <button
            type="button"
            class="bg-primary text-primary-foreground inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium hover:opacity-90"
            (click)="copy()">
            <app-icon class="h-4 w-4" aria-hidden="true">{{ $copied() ? 'check' : 'content_copy' }}</app-icon>{{ $copied() ? (data.masculine ? 'Copiado' : 'Copiada') : 'Copiar' }}
          </button>
        </div>
        <div class="flex items-start gap-2 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
          <app-icon class="h-5 w-5 shrink-0" aria-hidden="true">warning</app-icon>
          <div>
            <p class="font-semibold">{{ data.masculine ? 'No lo volverás a ver.' : 'No la volverás a ver.' }}</p>
            <p>{{ data.masculine ? 'Cópialo y guárdalo en un lugar seguro antes de cerrar. Si lo pierdes, tendrás que rotarlo.' : 'Cópiala y guárdala en un lugar seguro antes de cerrar. Si la pierdes, tendrás que crear otra.' }}</p>
            @if (data.warning) {
            <p class="mt-1">{{ data.warning }}</p>
            }
          </div>
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end">
          <app-button type="button" impact="bold" tone="primary" (buttonClick)="close()">Entendido, cerrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class SecretOnceModalComponent {
  readonly #dialogRef = inject<MatDialogRef<SecretOnceModalComponent>>(MatDialogRef);
  readonly #toast = inject(ToastService);
  readonly data = inject<SecretOnceModalData>(MAT_DIALOG_DATA);

  readonly $secret = signal(this.data.secret);
  readonly $copied = signal(false);

  async copy() {
    const ok = await copyToClipboard(this.$secret());
    if (ok) {
      this.$copied.set(true);
      this.#toast.show('Copiado al portapapeles', 'success');
    } else {
      this.#toast.show('No se pudo copiar: selecciónalo y cópialo a mano', 'error');
    }
  }

  close() {
    this.$secret.set('');
    this.#dialogRef.close();
  }
}

export function openSecretOnceModal(dialog: MatDialog, data: SecretOnceModalData): Observable<void> {
  return dialog
    .open<SecretOnceModalComponent, SecretOnceModalData, void>(SecretOnceModalComponent, {
      width: '560px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: false,
      data,
    })
    .afterClosed();
}
