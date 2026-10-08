import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import { IconComponent } from 'src/ui';

/**
 * Lista de valores cortos (rutas, etiquetas) como chips. Enter o coma agrega; Backspace en vacío quita el último.
 * `normalize` limpia el valor y `validate` devuelve el motivo del rechazo (que la página muestra en un toast).
 */
@Component({
  selector: 'app-admin-chip-input',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="glass-input flex min-h-[2.625rem] w-full flex-wrap items-center gap-1.5 rounded-md px-2 py-1.5"
      (click)="field.focus()">
      @for (value of values(); track value) {
      <span class="bg-primary/10 text-foreground inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium">
        <span class="truncate" [class.font-mono]="mono()">{{ value }}</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          [attr.aria-label]="'Quitar ' + value"
          (click)="remove(value); $event.stopPropagation()">
          <app-icon class="h-4 w-4">close</app-icon>
        </button>
      </span>
      }
      <input
        #field
        type="text"
        class="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        [class.font-mono]="mono()"
        [id]="inputId()"
        [attr.maxlength]="maxLength()"
        [placeholder]="values().length >= max() ? '' : placeholder()"
        [disabled]="values().length >= max()"
        [value]="$draft()"
        (input)="$draft.set($any($event.target).value)"
        (keydown)="handleKeydown($event)"
        (blur)="add()" />
    </div>
  `,
})
export class AdminChipInputComponent {
  readonly values = model<string[]>([]);
  readonly inputId = input<string>('');
  readonly placeholder = input('');
  readonly max = input(20);
  readonly maxLength = input(255);
  readonly mono = input(false);
  readonly normalize = input<(value: string) => string>((value) => value.trim());
  readonly validate = input<(value: string) => string | null>(() => null);
  /** Motivo por el que no se agregó un valor. */
  readonly rejected = output<string>();

  readonly $draft = signal('');

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.add();
    } else if (event.key === 'Backspace' && !this.$draft() && this.values().length) {
      this.values.update((values) => values.slice(0, -1));
    }
  }

  add() {
    const value = this.normalize()(this.$draft());
    if (!value) {
      this.$draft.set('');
      return;
    }
    if (this.values().length >= this.max()) {
      this.rejected.emit(`Máximo ${this.max()} valores`);
      return;
    }
    const error = this.validate()(value);
    if (error) {
      this.rejected.emit(error);
      return;
    }
    this.$draft.set('');
    if (this.values().includes(value)) return;
    this.values.update((values) => [...values, value]);
  }

  remove(value: string) {
    this.values.update((values) => values.filter((item) => item !== value));
  }
}
