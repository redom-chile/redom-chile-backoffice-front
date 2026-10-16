import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IconComponent, ToastService } from 'src/ui';
import { copyToClipboard } from './public-api-format';

/** Bloque de código con botón Copiar. */
@Component({
  selector: 'app-code-block',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-hidden rounded-lg border border-[var(--border)] bg-zinc-950 text-zinc-100">
      <div class="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span class="font-mono text-xs text-zinc-400">{{ label() }}</span>
        <button
          type="button"
          class="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-zinc-200 hover:bg-white/10"
          [attr.aria-label]="'Copiar ' + label()"
          (click)="copy()">
          <app-icon class="h-4 w-4" aria-hidden="true">{{ $copied() ? 'check' : 'content_copy' }}</app-icon>{{ $copied() ? 'Copiado' : 'Copiar' }}
        </button>
      </div>
      <pre class="max-h-96 overflow-auto p-3 font-mono text-xs leading-relaxed whitespace-pre"><code>{{ code() }}</code></pre>
    </div>
  `,
})
export class CodeBlockComponent {
  readonly #toast = inject(ToastService);

  readonly code = input.required<string>();
  readonly label = input('código');
  readonly $copied = signal(false);

  async copy() {
    if (await copyToClipboard(this.code())) {
      this.$copied.set(true);
      this.#toast.show('Código copiado', 'success');
      setTimeout(() => this.$copied.set(false), 2000);
    } else {
      this.#toast.show('No se pudo copiar el código', 'error');
    }
  }
}
