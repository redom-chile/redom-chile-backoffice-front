import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LegalApiService, LegalVersionDto } from 'src/app/core/services/legal';
import { MarkdownComponent } from 'src/app/modules/help/ui/markdown';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective } from 'src/ui';
import { formatLegalDate, legalPageUrl } from '../legal-format';

export type LegalReaderDialogData = Readonly<{ versionId: number; documentCode: string; title: string }>;

/** Lee una versión exacta de un documento (markdown sin HTML y PDF si tiene). */
@Component({
  selector: 'app-legal-reader-dialog',
  imports: [ModalCardComponent, SlotDirective, ButtonComponent, IconComponent, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-card>
      <ng-template app-slot="header">
        <div class="min-w-0">
          <h2 id="legal-reader-title" class="text-foreground text-lg font-semibold sm:text-xl">
            {{ $version()?.title ?? data.title }}
          </h2>
          @if ($version(); as version) {
          <p class="text-muted-foreground text-xs">
            Versión {{ version.version }}@if (date(version.effectiveAt); as effective) { · vigente desde el
            {{ effective }} }
          </p>
          }
        </div>
      </ng-template>

      <div class="max-h-[60vh] overflow-y-auto p-2" tabindex="0" aria-labelledby="legal-reader-title">
        @if ($version(); as version) {
        <app-markdown [content]="version.content" />
        } @else if ($failed()) {
        <p class="text-muted-foreground text-sm" role="alert">
          No pudimos cargar el documento. Revisa tu conexión e inténtalo de nuevo.
        </p>
        } @else {
        <div class="space-y-2" aria-busy="true" aria-label="Cargando documento">
          @for (line of [1, 2, 3, 4, 5]; track line) {
          <div class="bg-muted/40 h-3 animate-pulse rounded"></div>
          }
        </div>
        }
      </div>

      <ng-template app-slot="footer">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-3 text-sm">
            @if ($version()?.pdfUrl; as pdf) {
            <a
              class="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
              [href]="pdf"
              target="_blank"
              rel="noopener noreferrer">
              <app-icon class="h-4 w-4" aria-hidden="true">picture_as_pdf</app-icon> Descargar PDF
            </a>
            }
            <a
              class="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
              [href]="pageUrl"
              target="_blank"
              rel="noopener">
              <app-icon class="h-4 w-4" aria-hidden="true">open_in_new</app-icon> Abrir en otra pestaña
            </a>
          </div>
          <app-button type="button" impact="light" tone="primary" (buttonClick)="dialogRef.close()">Cerrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LegalReaderDialogComponent {
  readonly dialogRef = inject<MatDialogRef<LegalReaderDialogComponent>>(MatDialogRef);
  readonly data = inject<LegalReaderDialogData>(MAT_DIALOG_DATA);
  readonly #api = inject(LegalApiService);

  readonly $version = signal<LegalVersionDto | null>(null);
  readonly $failed = signal(false);
  readonly pageUrl = legalPageUrl(this.data.documentCode, this.data.versionId);
  readonly date = formatLegalDate;

  constructor() {
    this.#api.getVersion(this.data.versionId).subscribe({
      next: (version) => this.$version.set(version),
      error: () => this.$failed.set(true),
    });
  }
}

export function openLegalReader(dialog: MatDialog, data: LegalReaderDialogData) {
  return dialog.open<LegalReaderDialogComponent, LegalReaderDialogData>(LegalReaderDialogComponent, {
    width: '720px',
    maxWidth: '95vw',
    autoFocus: 'dialog',
    data,
  });
}
