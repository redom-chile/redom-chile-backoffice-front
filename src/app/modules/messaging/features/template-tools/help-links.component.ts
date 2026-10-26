import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from 'src/ui';

export type HelpArticleLink = Readonly<{ slug: string; label: string }>;

export const MESSAGING_HELP: Readonly<Record<'automations' | 'campaigns' | 'unsubscribes', HelpArticleLink>> = {
  automations: { slug: 'mensajes-automaticos', label: 'Mensajes automáticos' },
  campaigns: { slug: 'campanas-por-correo', label: 'Campañas por correo' },
  unsubscribes: { slug: 'bajas-y-buenas-practicas', label: 'Bajas y buenas prácticas' },
};

/** Enlaces al centro de ayuda (/help/:slug). */
@Component({
  selector: 'app-help-links',
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span class="inline-flex items-center gap-1"><app-icon class="h-4 w-4" aria-hidden="true">help</app-icon>Ayuda:</span>
      @for (link of links(); track link.slug) {
      <a [routerLink]="['/help', link.slug]" class="text-primary font-medium hover:underline">{{ link.label }}</a>
      }
    </p>
  `,
})
export class HelpLinksComponent {
  readonly links = input.required<readonly HelpArticleLink[]>();
}
