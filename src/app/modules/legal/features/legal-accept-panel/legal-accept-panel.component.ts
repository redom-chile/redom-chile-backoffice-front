import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  LegalAcceptResultDto,
  LegalApiService,
  legalDocumentsOf,
  LegalErrorCode,
  legalErrorMessage,
  PendingDocumentDto,
  requiredAccepted,
} from 'src/app/core/services/legal';
import { readApiError } from 'src/app/core/utils/api-error';
import { AuthService } from 'src/app/modules/auth/pages/data-access/auth.service';
import { SessionDto } from 'src/app/modules/auth/pages/dtos';
import { ButtonComponent, ToastService } from 'src/ui';
import { LegalDocumentChecklistComponent } from '../../ui';

export type LegalAcceptResult = LegalAcceptResultDto<SessionDto>;

/**
 * Aceptar los documentos pendientes de la sesión (POST /legal/accept). Sin documentos de entrada los pide a /legal/me.
 * Emite `done` cuando ya no queda ningún obligatorio; con la sesión restringida trae la sesión normal.
 */
@Component({
  selector: 'app-legal-accept-panel',
  imports: [ButtonComponent, LegalDocumentChecklistComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($documents(); as documents) { @if (documents.length) {
    <app-legal-document-checklist
      [documents]="documents"
      [(accepted)]="$accepted"
      [disabled]="$saving()"
      [showErrors]="$submitted()"
      showChanges />
    } @else {
    <p class="text-muted-foreground text-sm">No tienes documentos por aceptar.</p>
    }
    <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <app-button type="button" impact="light" tone="primary" [disabled]="$saving()" (buttonClick)="logout()"
        >Cerrar sesión</app-button
      >
      <app-button
        type="button"
        impact="bold"
        tone="primary"
        [disabled]="$saving()"
        [isLoading]="$saving()"
        (buttonClick)="accept()">
        {{ documents.length ? 'Aceptar y continuar' : 'Continuar' }}
      </app-button>
    </div>
    } @else if ($failed()) {
    <div class="space-y-3 text-sm" role="alert">
      <p class="text-muted-foreground">No pudimos cargar tus documentos. Revisa tu conexión e inténtalo de nuevo.</p>
      <div class="flex flex-wrap gap-2">
        <app-button type="button" impact="bold" tone="primary" size="small" (buttonClick)="load()"
          >Reintentar</app-button
        >
        <app-button type="button" impact="light" tone="primary" size="small" (buttonClick)="logout()"
          >Cerrar sesión</app-button
        >
      </div>
    </div>
    } @else {
    <div class="space-y-2" aria-busy="true" aria-label="Cargando documentos">
      <div class="bg-muted/40 h-14 animate-pulse rounded-xl"></div>
      <div class="bg-muted/40 h-14 animate-pulse rounded-xl"></div>
    </div>
    }
  `,
})
export class LegalAcceptPanelComponent {
  readonly #api = inject(LegalApiService);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  /** null: se piden a /legal/me. */
  readonly documents = input<readonly PendingDocumentDto[] | null>(null);
  readonly done = output<LegalAcceptResult>();
  readonly loggedOut = output<void>();

  readonly $documents = signal<readonly PendingDocumentDto[] | null>(null);
  readonly $accepted = signal<readonly number[]>([]);
  readonly $saving = signal(false);
  readonly $submitted = signal(false);
  readonly $failed = signal(false);

  constructor() {
    effect(() => {
      const given = this.documents();
      untracked(() => (given?.length ? this.#show(given) : this.load()));
    });
  }

  load() {
    this.$failed.set(false);
    this.$documents.set(null);
    this.#api
      .me()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (me) => this.#show(me.pending),
        error: () => this.$failed.set(true),
      });
  }

  accept() {
    const documents = this.$documents() ?? [];
    if (this.$saving()) return;
    this.$submitted.set(true);
    if (!requiredAccepted(documents, this.$accepted())) return;
    this.$saving.set(true);
    this.#api
      .accept<SessionDto>([...this.$accepted()])
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.$saving.set(false);
          if (!result.pending.some((document) => document.isRequired)) {
            this.done.emit(result);
            return;
          }
          // Se publicó otra versión mientras leía: se piden las que faltan.
          this.#show(result.pending);
          this.#toast.show('Hay documentos nuevos por aceptar', 'warning');
        },
        error: (error: unknown) => {
          this.$saving.set(false);
          const code = readApiError(error).code;
          this.#toast.show(
            legalErrorMessage(error) ?? 'No pudimos registrar tu aceptación. Inténtalo de nuevo.',
            'error',
          );
          const documents = legalDocumentsOf(error);
          if (documents?.length) this.#show(documents);
          else if (code === LegalErrorCode.VERSION_NOT_PUBLISHED) this.load();
        },
      });
  }

  logout() {
    this.$saving.set(true);
    this.#auth.logout().subscribe({ error: () => undefined });
    // logout borra la sesión local al terminar, responda o no el backend.
    this.loggedOut.emit();
    this.#router.navigateByUrl('/auth/sign-in');
  }

  #show(documents: readonly PendingDocumentDto[]) {
    this.$documents.set(documents);
    this.$accepted.set([]);
    this.$submitted.set(false);
  }
}
