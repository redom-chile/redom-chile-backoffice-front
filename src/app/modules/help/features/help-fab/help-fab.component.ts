import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { IconComponent } from 'src/ui';
import { HelpPanelService } from '../help-panel/help-panel.service';

/** Botón flotante del asistente (esquina inferior derecha): abre el panel de ayuda en la pestaña del chat. */
@Component({
  selector: 'app-help-fab',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!panel.$open()) {
    <button
      type="button"
      class="help-fab bg-primary text-primary-foreground fixed right-4 bottom-24 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:right-6 md:bottom-6"
      aria-label="Abrir el asistente de ayuda"
      title="Pregúntale al asistente"
      (click)="panel.open('chat')">
      <app-icon class="h-6 w-6">auto_awesome</app-icon>
      @if ($locked()) {
      <span class="bg-background text-muted-foreground absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] shadow-sm" title="El asistente con IA no está incluido en tu plan">
        <app-icon class="h-3 w-3">lock</app-icon>
      </span>
      }
    </button>
    }
  `,
  styles: `
    .help-fab {
      animation: help-fab-in 180ms ease-out;
    }
    @keyframes help-fab-in {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .help-fab {
        animation: none;
      }
    }
  `,
})
export class HelpFabComponent {
  readonly panel = inject(HelpPanelService);
  readonly #entitlements = inject(EntitlementsService);
  /** El plan no incluye el asistente: el botón sigue (abre los artículos y el aviso) con un candado. */
  readonly $locked = computed(() => !this.#entitlements.hasFeature('help_assistant'));
}
