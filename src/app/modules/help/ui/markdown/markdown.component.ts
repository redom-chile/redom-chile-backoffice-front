import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { renderMarkdown } from './markdown';

/**
 * Muestra markdown (artículos y respuestas del asistente) con los colores del tema.
 * Los enlaces internos (/help/…) navegan con el router; los externos se abren en otra pestaña.
 */
@Component({
  selector: 'app-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `<div class="help-markdown prose prose-sm max-w-none" [class.prose-base]="size() === 'base'" [innerHTML]="$html()" (click)="handleClick($event)"></div>`,
  styles: `
    .help-markdown {
      --tw-prose-body: var(--foreground);
      --tw-prose-headings: var(--foreground);
      --tw-prose-bold: var(--foreground);
      --tw-prose-links: var(--primary);
      --tw-prose-counters: var(--muted-foreground);
      --tw-prose-bullets: var(--muted-foreground);
      --tw-prose-quotes: var(--foreground);
      --tw-prose-quote-borders: var(--border);
      --tw-prose-hr: var(--border);
      --tw-prose-code: var(--foreground);
      --tw-prose-th-borders: var(--border);
      --tw-prose-td-borders: var(--border);
      overflow-wrap: anywhere;
    }
    .help-markdown :where(table) {
      display: block;
      overflow-x: auto;
    }
    .help-markdown :where(> :first-child) {
      margin-top: 0;
    }
    .help-markdown :where(> :last-child) {
      margin-bottom: 0;
    }
  `,
})
export class MarkdownComponent {
  readonly #router = inject(Router);

  readonly content = input<string | null | undefined>('');
  readonly size = input<'sm' | 'base'>('sm');

  readonly $html = computed(() => renderMarkdown(this.content()));

  handleClick(event: MouseEvent) {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    const href = anchor?.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    if (href.startsWith('/')) {
      this.#router.navigateByUrl(href);
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }
}
