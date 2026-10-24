import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { IconComponent } from 'src/ui';
import { AiSettingsField } from '../data-access';
import { MenuAiStore } from '../menu-ai.store';

/** Aviso de que la IA (o las sugerencias) está apagada, con el enlace a Configuración. */
@Component({
  selector: 'app-menu-ai-callout',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-primary/10 mb-4 flex flex-col gap-3 rounded-xl p-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="note">
      <p class="text-foreground flex items-start gap-2">
        <app-icon class="text-primary h-5 w-5 shrink-0" aria-hidden="true">toggle_off</app-icon>
        <span>{{ text() }}</span>
      </p>
      <button
        type="button"
        class="bg-primary text-primary-foreground inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full px-4 text-sm font-semibold hover:opacity-90"
        (click)="open()">
        <app-icon class="h-4 w-4" aria-hidden="true">tune</app-icon>Ir a Configuración
      </button>
    </div>
  `,
})
export class MenuAiCalloutComponent {
  readonly text = input('La IA está apagada. Actívala en Configuración para pedir sugerencias.');
  /** Ajuste que se enfoca al llegar a Configuración. */
  readonly setting = input<AiSettingsField>('isEnabled');
  readonly openSettings = output<void>();

  readonly #store = inject(MenuAiStore);

  open() {
    this.#store.$focusSetting.set(this.setting());
    this.openSettings.emit();
  }
}
