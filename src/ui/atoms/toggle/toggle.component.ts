import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-toggle',
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './toggle.component.html',
})
export class ToggleComponent {
  readonly $checked = input<boolean>(false, { alias: 'checked' });
  readonly $disabled = input<boolean>(false, { alias: 'disabled' });
  /** Nombre accesible cuando no hay un texto visible asociado. */
  readonly $ariaLabel = input<string | null>(null, { alias: 'ariaLabel' });

  readonly $changed = output<boolean>({ alias: 'changed' });

  onChange(event: Event) {
    this.$changed.emit((event.target as HTMLInputElement).checked);
  }
}
