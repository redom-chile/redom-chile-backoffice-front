import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PendingDocumentDto } from 'src/app/core/services/legal';
import { IconComponent } from 'src/ui';
import { openLegalReader } from '../legal-reader-dialog/legal-reader-dialog.component';

let nextId = 0;

/** Documentos por aceptar: cada uno con su casilla y un enlace para leerlo (los obligatorios son requisito). */
@Component({
  selector: 'app-legal-document-checklist',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="space-y-2" [attr.aria-describedby]="$showError() ? errorId : null">
      @if (legend()) {
      <legend class="text-foreground mb-1 text-sm font-medium">{{ legend() }}</legend>
      } @for (document of documents(); track document.versionId) {
      <div
        class="flex items-start gap-3 rounded-xl border px-3 py-2.5"
        [class]="
          $showError() && document.isRequired && !accepted().includes(document.versionId)
            ? 'border-red-500/60'
            : 'border-[var(--border)]'
        ">
        <input
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--primary)]"
          [id]="baseId + '-' + document.versionId"
          [checked]="accepted().includes(document.versionId)"
          [disabled]="disabled()"
          (change)="toggle(document.versionId, $any($event.target).checked)" />
        <div class="min-w-0 flex-1 text-sm">
          <label class="text-foreground cursor-pointer" [for]="baseId + '-' + document.versionId">
            Leí y acepto <span class="font-semibold">{{ document.title }}</span> @if (!document.isRequired) {
            <span class="text-muted-foreground">(opcional)</span> }
          </label>
          <span class="text-muted-foreground block text-xs">
            Versión {{ document.version }}
            @if (document.isMaterialChange && showChanges()) { · con cambios importantes } ·
            <button
              type="button"
              class="text-primary inline-flex items-center gap-0.5 font-semibold hover:underline"
              (click)="read(document)">
              Leer<span class="sr-only"> {{ document.title }}</span>
              <app-icon class="h-3.5 w-3.5" aria-hidden="true">open_in_new</app-icon>
            </button>
          </span>
        </div>
      </div>
      } @if ($showError()) {
      <p [id]="errorId" class="text-destructive text-xs" role="alert">
        Para seguir, marca los documentos obligatorios.
      </p>
      }
    </fieldset>
  `,
})
export class LegalDocumentChecklistComponent {
  readonly #dialog = inject(MatDialog);

  readonly documents = input.required<readonly PendingDocumentDto[]>();
  /** versionId marcados. */
  readonly accepted = model<readonly number[]>([]);
  readonly legend = input<string>('');
  readonly disabled = input(false);
  /** Marca en rojo los obligatorios sin aceptar (después de intentar seguir). */
  readonly showErrors = input(false);
  readonly showChanges = input(false, { transform: booleanAttribute });

  readonly baseId = `legal-doc-${++nextId}`;
  readonly errorId = `${this.baseId}-error`;
  readonly $showError = computed(
    () =>
      this.showErrors() &&
      this.documents().some((document) => document.isRequired && !this.accepted().includes(document.versionId)),
  );

  toggle(versionId: number, checked: boolean) {
    const others = this.accepted().filter((id) => id !== versionId);
    this.accepted.set(checked ? [...others, versionId] : others);
  }

  read(document: PendingDocumentDto) {
    openLegalReader(this.#dialog, {
      versionId: document.versionId,
      documentCode: document.documentCode,
      title: document.title,
    });
  }
}
