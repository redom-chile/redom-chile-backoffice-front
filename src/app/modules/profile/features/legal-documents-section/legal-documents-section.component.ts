import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { AcceptedDocumentDto, LegalApiService, LegalMeDto } from 'src/app/core/services/legal';
import { LegalPromptService } from 'src/app/core/services/legal/legal-prompt.service';
import { formatLegalDate, openLegalReader } from 'src/app/modules/legal/ui';
import { ButtonComponent, IconComponent } from 'src/ui';

const ACTION_LABELS: Record<AcceptedDocumentDto['action'], string> = {
  accept: 'Aceptado',
  withdraw: 'Retirado',
  acknowledge: 'Informado',
};

/** "Mis documentos": lo que aceptaste (con la versión exacta) y lo que te falta aceptar. */
@Component({
  selector: 'app-legal-documents-section',
  imports: [ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass rounded-2xl p-5 sm:p-6" aria-labelledby="legal-documents-title">
      <header class="mb-4">
        <h3 id="legal-documents-title" class="text-foreground text-base font-semibold">Mis documentos</h3>
        <p class="text-muted-foreground text-xs">Términos, privacidad y condiciones que aceptaste en Redom.</p>
      </header>

      @if ($me(); as me) { @if (me.pending.length) {
      <div
        class="bg-amber-500/15 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-300"
        role="status">
        <p>Tienes {{ me.pending.length === 1 ? '1 documento' : me.pending.length + ' documentos' }} por aceptar.</p>
        <app-button impact="bold" tone="primary" size="small" type="button" (buttonClick)="acceptPending(me)"
          >Revisar y aceptar</app-button
        >
      </div>
      } @if (me.accepted.length) {
      <ul class="divide-border divide-y divide-dashed">
        @for (record of me.accepted; track record.versionId + '-' + record.createdAt) {
        <li class="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
          <div class="min-w-0">
            <p class="text-foreground text-sm font-medium">{{ record.title }}</p>
            <p class="text-muted-foreground text-xs">
              {{ actionLabel(record) }} · versión {{ record.version }}@if (date(record.createdAt); as when) { ·
              {{ when }} } @if (record.businessId) { · por tu negocio }
            </p>
          </div>
          <app-button impact="light" tone="primary" size="small" type="button" (buttonClick)="read(record)">
            <app-icon class="h-4 w-4" aria-hidden="true">description</app-icon> Leer
            <span class="sr-only">{{ record.title }}, versión {{ record.version }}</span>
          </app-button>
        </li>
        }
      </ul>
      } @else if (!me.pending.length) {
      <p class="text-muted-foreground text-sm">Aún no hay documentos registrados.</p>
      } } @else if ($failed()) {
      <div class="flex flex-wrap items-center gap-3 text-sm" role="alert">
        <p class="text-muted-foreground">No pudimos cargar tus documentos.</p>
        <app-button impact="light" tone="primary" size="small" type="button" (buttonClick)="load()"
          >Reintentar</app-button
        >
      </div>
      } @else {
      <div class="space-y-2" aria-busy="true" aria-label="Cargando documentos">
        <div class="bg-muted/40 h-10 animate-pulse rounded-lg"></div>
        <div class="bg-muted/40 h-10 animate-pulse rounded-lg"></div>
      </div>
      }
    </section>
  `,
})
export class LegalDocumentsSectionComponent {
  readonly #api = inject(LegalApiService);
  readonly #prompt = inject(LegalPromptService);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);

  readonly $me = signal<LegalMeDto | null>(null);
  readonly $failed = signal(false);
  readonly date = formatLegalDate;

  constructor() {
    this.load();
  }

  load() {
    this.$failed.set(false);
    this.$me.set(null);
    this.#api
      .me()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (me) => this.$me.set(me),
        error: () => this.$failed.set(true),
      });
  }

  actionLabel(record: AcceptedDocumentDto): string {
    return ACTION_LABELS[record.action] ?? record.action;
  }

  read(record: AcceptedDocumentDto) {
    openLegalReader(this.#dialog, {
      versionId: record.versionId,
      documentCode: record.documentCode,
      title: record.title,
    });
  }

  acceptPending(me: LegalMeDto) {
    this.#prompt
      .require(me.pending)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((accepted) => accepted && this.load());
  }
}
