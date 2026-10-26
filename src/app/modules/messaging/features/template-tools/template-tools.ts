import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TEMPLATE_VARIABLES, TemplateVariable, VARIABLE_LABELS } from 'src/app/modules/messaging/data-access';

/** Botones para insertar {{variable}} en el campo que tiene el foco (o el último usado). */
@Component({
  selector: 'app-template-variables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Insertar variable">
      <span class="text-muted-foreground mr-1 text-xs">Insertar:</span>
      @for (variable of variables; track variable) {
      <button
        type="button"
        class="glass-row text-foreground rounded-full px-2.5 py-1 text-xs font-medium hover:opacity-80 disabled:opacity-50"
        [class.ring-2]="invalid() === variable"
        [class.ring-red-500]="invalid() === variable"
        [disabled]="disabled()"
        [title]="token(variable)"
        (mousedown)="$event.preventDefault()"
        (click)="insert.emit(variable)">
        {{ labels[variable] }}
      </button>
      }
    </div>
  `,
})
export class TemplateVariablesComponent {
  readonly variables = TEMPLATE_VARIABLES;
  readonly labels = VARIABLE_LABELS;
  readonly disabled = input(false);
  /** Variable rechazada por el backend (se marca). */
  readonly invalid = input<string | null>(null);
  readonly insert = output<TemplateVariable>();

  token(variable: TemplateVariable): string {
    return `{{${variable}}}`;
  }
}

/** Inserta el texto en la posición del cursor del input/textarea y actualiza el control. */
export function insertAtCursor(element: HTMLInputElement | HTMLTextAreaElement | null, control: AbstractControl<string>, text: string) {
  const value = control.value ?? '';
  const start = element?.selectionStart ?? value.length;
  const end = element?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + text + value.slice(end);
  const max = element?.maxLength && element.maxLength > 0 ? element.maxLength : Infinity;
  if (next.length > max) return;
  control.setValue(next);
  control.markAsDirty();
  if (!element) return;
  queueMicrotask(() => {
    element.focus();
    const caret = start + text.length;
    element.setSelectionRange(caret, caret);
  });
}
