import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CartaIcon } from './carta-icon';

/** Cantidad con − y + (botones de 36 px; en "small", 32 px). */
@Component({
  selector: 'app-carta-stepper',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center rounded-full border border-border bg-background', role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    <button
      type="button"
      class="flex items-center justify-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary"
      [class]="small() ? 'size-8' : 'size-9'"
      [disabled]="value() <= min()"
      [attr.aria-label]="'Quitar uno de ' + label()"
      (click)="change.emit(value() - 1)"
    >
      <app-carta-icon name="minus" [size]="small() ? 14 : 16" />
    </button>
    <span class="min-w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{{ value() }}</span>
    <button
      type="button"
      class="flex items-center justify-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary"
      [class]="small() ? 'size-8' : 'size-9'"
      [disabled]="value() >= max()"
      [attr.aria-label]="'Agregar uno de ' + label()"
      (click)="change.emit(value() + 1)"
    >
      <app-carta-icon name="plus" [size]="small() ? 14 : 16" />
    </button>
  `,
})
export class CartaStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly max = input(20);
  /** Qué se cuenta ("Lomo saltado", "Cantidad"). */
  readonly label = input('Cantidad');
  readonly small = input(false);
  readonly change = output<number>();
}
