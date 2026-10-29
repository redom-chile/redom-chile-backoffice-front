import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MarkdownComponent } from 'src/app/modules/help/ui/markdown';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective } from 'src/ui';
import {
  formatPlatformDate,
  LEGAL_LANGUAGE_LABELS,
  LEGAL_VERSION_STATE_LABELS,
  LEGAL_VERSION_STATE_TONES,
  LegalDocumentVersionDto,
  legalVersionState,
} from '../../data-access';
import { copyLegalHash } from './copy-hash';

export type LegalVersionViewData = Readonly<{ title: string; version: LegalDocumentVersionDto }>;

/** Versión publicada o retirada: solo lectura (contenido, hash y PDF). */
@Component({
  selector: 'app-legal-version-view-modal',
  imports: [ButtonComponent, ModalCardComponent, SlotDirective, IconComponent, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let v = data.version;
    @let state = stateOf(v);
    <app-modal-card>
      <ng-template app-slot="header">
        <div class="min-w-0">
          <h2 class="truncate text-xl font-semibold">{{ data.title }}</h2>
          <p class="text-muted-foreground text-sm">Versión {{ v.version }} · {{ languages[v.language] ?? v.language }}</p>
        </div>
      </ng-template>

      <div class="space-y-4 p-2 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="tones[state]">{{ states[state] }}</span>
          <span class="rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium">{{ v.isMaterialChange ? 'Cambio material' : 'Cambio no material' }}</span>
        </div>
        <dl class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-xs">Vigente desde (hora de Chile)</dt>
            <dd class="text-foreground">{{ formatDate(v.effectiveAt, true) }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-xs">Publicada</dt>
            <dd class="text-foreground">{{ formatDate(v.publishedAt, true) }}</dd>
          </div>
          @if (v.retiredAt) {
            <div>
              <dt class="text-muted-foreground text-xs">Retirada</dt>
              <dd class="text-foreground">{{ formatDate(v.retiredAt, true) }}</dd>
            </div>
          }
          @if (v.notifiedAt) {
            <div>
              <dt class="text-muted-foreground text-xs">Avisos completos</dt>
              <dd class="text-foreground">{{ formatDate(v.notifiedAt, true) }}</dd>
            </div>
          }
          <div class="sm:col-span-2">
            <dt class="text-muted-foreground text-xs">Hash (sha256 del contenido y el PDF)</dt>
            <dd class="flex items-center gap-2">
              <code class="text-foreground min-w-0 flex-1 break-all font-mono text-xs">{{ v.contentHash ?? '—' }}</code>
              @if (v.contentHash) {
                <button type="button" class="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1.5" title="Copiar hash" aria-label="Copiar hash" (click)="copy(v.contentHash)">
                  <app-icon class="h-5 w-5">content_copy</app-icon>
                </button>
              }
            </dd>
          </div>
        </dl>
        @if (v.changeSummary) {
          <div>
            <p class="text-muted-foreground text-xs">Resumen de cambios</p>
            <p class="text-foreground whitespace-pre-line">{{ v.changeSummary }}</p>
          </div>
        }
        @if (v.pdfUrl) {
          <a [href]="v.pdfUrl" target="_blank" rel="noopener noreferrer" class="text-primary inline-flex items-center gap-1 font-medium hover:underline">
            <app-icon class="h-5 w-5">picture_as_pdf</app-icon>
            Abrir PDF
          </a>
        }
        <div class="glass rounded-lg p-4">
          <app-markdown [content]="v.content" />
        </div>
      </div>

      <ng-template app-slot="footer">
        <div class="flex justify-end">
          <app-button type="button" impact="light" (buttonClick)="dialogRef.close()">Cerrar</app-button>
        </div>
      </ng-template>
    </app-modal-card>
  `,
})
export class LegalVersionViewModalComponent {
  readonly dialogRef = inject(MatDialogRef<LegalVersionViewModalComponent>);
  readonly data = inject<LegalVersionViewData>(MAT_DIALOG_DATA);
  readonly languages = LEGAL_LANGUAGE_LABELS;
  readonly states = LEGAL_VERSION_STATE_LABELS;
  readonly tones = LEGAL_VERSION_STATE_TONES;
  readonly stateOf = legalVersionState;
  readonly formatDate = formatPlatformDate;
  readonly copy = copyLegalHash();
}

export function openLegalVersionViewModal(dialog: MatDialog, data: LegalVersionViewData): void {
  dialog.open<LegalVersionViewModalComponent, LegalVersionViewData>(LegalVersionViewModalComponent, { width: '760px', maxWidth: '95vw', data });
}
