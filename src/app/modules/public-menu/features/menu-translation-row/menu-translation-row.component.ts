import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MenuTranslationItemDto } from 'src/app/modules/public-menu/data-access';
import { ENTITY_LABELS, FIELD_LABELS, OUTDATED_TEXT, TRANSLATION_MAX_LENGTH } from 'src/app/modules/public-menu/features/menu-translation-shared';
import { IconComponent } from 'src/ui';

/** Una fila de la pantalla de traducciones: original (solo lectura) y traducción (editable). En el celular se apilan. */
@Component({
  selector: 'app-menu-translation-row',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let row = item();
    @let translation = row.translation;
    <article class="glass-row grid grid-cols-1 gap-3 rounded-xl p-3 md:grid-cols-2 md:gap-4" [class.ring-2]="dirty()" [class.ring-primary]="dirty()">
      <!-- Original -->
      <div class="min-w-0">
        <div class="mb-1 flex flex-wrap items-center gap-1.5">
          <span class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{{ $label() }}</span>
          <span class="text-muted-foreground text-xs md:hidden">· Original</span>
        </div>
        <p class="text-foreground whitespace-pre-line break-words text-sm">{{ row.original }}</p>
      </div>

      <!-- Traducción -->
      <div class="min-w-0">
        <div class="mb-1 flex flex-wrap items-center gap-1.5">
          <span class="text-muted-foreground text-xs md:hidden">Traducción</span>
          @if (dirty()) {
          <span class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">Sin guardar</span>
          } @else if (!translation) {
          <span class="bg-muted/60 text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">Sin traducir</span>
          }
          @if (translation) {
          @if (translation.status === 'published') {
          <span class="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">Publicada</span>
          } @else {
          <span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">Borrador</span>
          }
          <span
            class="bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
            [title]="translation.source === 'ai' ? 'Traducida con IA' : 'Escrita a mano'">
            @if (translation.source === 'ai') {
            <app-icon class="h-3.5 w-3.5" aria-hidden="true">auto_awesome</app-icon>IA
            } @else {
            <app-icon class="h-3.5 w-3.5" aria-hidden="true">edit</app-icon>Manual
            }
          </span>
          }
          @if (canEdit() && translation) {
          <button
            type="button"
            class="text-muted-foreground hover:text-destructive ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-50"
            [disabled]="deleting()"
            [attr.aria-label]="'Borrar traducción de ' + $label()"
            title="Borrar traducción"
            (click)="remove.emit()">
            <app-icon class="h-4 w-4" aria-hidden="true">delete</app-icon>
          </button>
          }
        </div>

        @if (translation?.outdated && !dirty()) {
        <p class="mb-1.5 flex items-start gap-1 text-xs font-medium text-amber-700 dark:text-amber-300" role="note">
          <app-icon class="h-4 w-4 shrink-0" aria-hidden="true">warning</app-icon>
          <span>
            {{ outdatedText }}
            @if (canEdit()) {
            <button type="button" class="text-primary ml-1 font-semibold hover:underline" (click)="textChange.emit(text())">Sigue bien</button>
            }
          </span>
        </p>
        }

        <textarea
          rows="2"
          class="glass-input w-full resize-y rounded-md px-3 py-2 text-sm"
          placeholder="Escribe la traducción"
          [attr.aria-label]="'Traducción de ' + $label()"
          [attr.maxlength]="maxLength"
          [class.border-red-500]="!!$error()"
          [value]="text()"
          [disabled]="!canEdit()"
          (input)="textChange.emit($any($event.target).value)"></textarea>
        <div class="mt-0.5 flex items-center justify-between gap-2 text-xs">
          <span class="text-red-600 dark:text-red-400">{{ $error() ?? '' }}</span>
          @if (dirty()) {
          <button type="button" class="text-muted-foreground hover:text-foreground font-medium" (click)="discard.emit()">Descartar</button>
          }
        </div>
      </div>
    </article>
  `,
})
export class MenuTranslationRowComponent {
  readonly item = input.required<MenuTranslationItemDto>();
  /** Texto en el textarea (editado o el guardado). */
  readonly text = input.required<string>();
  readonly dirty = input(false);
  readonly canEdit = input(false);
  readonly deleting = input(false);

  readonly textChange = output<string>();
  readonly discard = output<void>();
  readonly remove = output<void>();

  readonly outdatedText = OUTDATED_TEXT;
  readonly maxLength = TRANSLATION_MAX_LENGTH;

  readonly $label = computed(() => `${ENTITY_LABELS[this.item().entity]} · ${FIELD_LABELS[this.item().field]}`);
  readonly $error = computed(() => (this.dirty() && !this.text().trim() ? 'Escribe la traducción o descarta el cambio.' : null));
}
