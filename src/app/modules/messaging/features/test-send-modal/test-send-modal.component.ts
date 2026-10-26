import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom, Observable } from 'rxjs';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { EMAIL_PATTERN, messagingError, TestResultDto, testResultMessage } from 'src/app/modules/messaging/data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';

export type TestSendModalData = Readonly<{
  /** Qué se prueba ("Te extrañamos", nombre de la campaña). */
  title: string;
  send: (email?: string) => Observable<TestResultDto>;
}>;

/** Envía una prueba con datos de ejemplo a un usuario del negocio (por defecto, a ti). Cuenta en el cupo. */
@Component({
  selector: 'app-test-send-modal',
  imports: [FormsModule, ModalCardComponent, SlotDirective, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <h2 class="text-xl font-semibold">Enviar prueba</h2>
      </ng-template>
      <form class="space-y-4 p-2" (ngSubmit)="handleSend()">
        <p class="text-muted-foreground text-sm">
          Te llega «{{ data.title }}» con datos de ejemplo. Solo puede ir al correo de un usuario de tu negocio y cuenta en el cupo del mes.
        </p>
        <div>
          <label for="test-email" class="mb-1 block text-sm font-medium">Correo</label>
          <input
            id="test-email"
            type="email"
            name="email"
            inputmode="email"
            autocomplete="email"
            class="glass-input w-full rounded-md px-3 py-2"
            [class.border-red-500]="!!$error()"
            [placeholder]="$myEmail() || 'Tu correo'"
            [(ngModel)]="email"
            [attr.aria-invalid]="!!$error()"
            aria-describedby="test-email-hint" />
          <p id="test-email-hint" class="mt-1 text-xs" [class]="$error() ? 'text-destructive' : 'text-muted-foreground'">
            {{ $error() ?? 'Déjalo vacío para enviarla a tu correo.' }}
          </p>
        </div>
        @if ($result(); as result) {
        <div
          class="flex items-start gap-2 rounded-lg p-3 text-sm"
          role="status"
          [class]="result.status === 'sent' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/10 text-amber-800 dark:text-amber-200'">
          <app-icon class="h-5 w-5 shrink-0" aria-hidden="true">{{ result.status === 'sent' ? 'mark_email_read' : 'warning' }}</app-icon>
          <p>{{ message(result) }}</p>
        </div>
        }
      </form>
      <ng-template app-slot="footer">
        <div class="flex justify-end gap-2">
          <app-button type="button" impact="light" [disabled]="$sending()" (buttonClick)="dialogRef.close()">Cerrar</app-button>
          <app-button type="button" impact="bold" [isLoading]="$sending()" (buttonClick)="handleSend()">
            {{ $result() ? 'Enviar otra' : 'Enviar prueba' }}
          </app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class TestSendModalComponent {
  readonly dialogRef = inject<MatDialogRef<TestSendModalComponent>>(MatDialogRef);
  readonly data = inject<TestSendModalData>(MAT_DIALOG_DATA);
  readonly #toast = inject(ToastService);
  readonly #entitlements = inject(EntitlementsService);
  readonly $myEmail = signal(inject(WhoamiService).$whoami()?.user.email ?? '');

  email = '';
  readonly $sending = signal(false);
  readonly $error = signal<string | null>(null);
  readonly $result = signal<TestResultDto | null>(null);

  message(result: TestResultDto): string {
    return testResultMessage(result);
  }

  async handleSend() {
    if (this.$sending()) return;
    const email = this.email.trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      this.$error.set('Ingresa un correo válido.');
      return;
    }
    this.$error.set(null);
    this.$sending.set(true);
    try {
      this.$result.set(await firstValueFrom(this.data.send(email || undefined)));
      this.#entitlements.refresh();
    } catch (error) {
      const { message, field } = messagingError(error, 'No se pudo enviar la prueba.');
      if (field === 'email') this.$error.set(message);
      else if (message) this.#toast.show(message, 'error');
    } finally {
      this.$sending.set(false);
    }
  }
}

export function openTestSendModal(dialog: MatDialog, data: TestSendModalData) {
  return dialog
    .open<TestSendModalComponent, TestSendModalData>(TestSendModalComponent, { width: '480px', maxWidth: '95vw', autoFocus: 'input', data })
    .afterClosed();
}
