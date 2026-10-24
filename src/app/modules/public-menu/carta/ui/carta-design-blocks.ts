import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ct } from '../carta-i18n';
import { CartaIcon } from './carta-icon';

/** "Escuchar" / "Detener" (lectura en voz alta). compact: solo el ícono en móvil. */
@Component({
  selector: 'app-carta-listen-button',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
      [class.bg-muted]="active()"
      [attr.aria-label]="active() ? t('design.stopReading') : label()"
      (click)="press.emit()"
    >
      <app-carta-icon [name]="active() ? 'stop' : 'speaker'" [size]="16" />
      <span [class]="compact() ? 'sr-only sm:not-sr-only' : ''" aria-hidden="true">{{ t(active() ? 'design.stop' : 'design.listen') }}</span>
    </button>
  `,
})
export class CartaListenButton {
  readonly active = input(false);
  /** aria-label al escuchar ("Escuchar Lomo a lo pobre"). */
  readonly label = input.required<string>();
  readonly compact = input(false);
  readonly press = output<void>();
  protected readonly t = ct;
}

/** Anuncio del local arriba de la carta; se puede cerrar. */
@Component({
  selector: 'app-carta-announcement',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <aside class="border-b border-primary/30 bg-primary/10" [attr.aria-label]="t('design.announcement')">
      <div class="mx-auto flex max-w-2xl items-start gap-3 px-4 py-2.5 text-sm font-medium">
        <app-carta-icon name="megaphone" [size]="18" class="mt-0.5 text-primary" />
        <p class="min-w-0 flex-1 whitespace-pre-line [overflow-wrap:anywhere]">{{ text() }}</p>
        <button
          type="button"
          class="-my-1 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary"
          [attr.aria-label]="t('design.dismissAnnouncement')"
          (click)="dismiss.emit()"
        >
          <app-carta-icon name="x" [size]="16" />
        </button>
      </div>
    </aside>
  `,
})
export class CartaAnnouncement {
  readonly text = input.required<string>();
  readonly dismiss = output<void>();
  protected readonly t = ct;
}

/** Más de esto se muestra recortado con "Leer más". */
const LONG_STORY = 420;

/** "Nuestra historia" al final de la carta. */
@Component({
  selector: 'app-carta-story',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="carta-section pt-8" aria-labelledby="carta-story-title">
      <div class="rounded-2xl border border-border bg-card p-5">
        <h2 id="carta-story-title" class="carta-heading flex items-center gap-2 text-xl font-bold tracking-tight">
          <app-carta-icon name="book-open" [size]="20" class="text-primary" />
          {{ t('design.story') }}
        </h2>
        <p id="carta-story-text" class="mt-3 whitespace-pre-line text-sm leading-relaxed [overflow-wrap:anywhere]" [class.line-clamp-6]="long() && !open()">{{ text() }}</p>
        @if (long()) {
          <button
            type="button"
            class="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
            aria-controls="carta-story-text"
            [attr.aria-expanded]="open()"
            (click)="open.update((v) => !v)"
          >
            {{ t(open() ? 'design.readLess' : 'design.readMore') }}
          </button>
        }
      </div>
    </section>
  `,
})
export class CartaStory {
  readonly text = input.required<string>();
  protected readonly t = ct;
  protected readonly open = signal(false);
  protected readonly long = computed(() => this.text().length > LONG_STORY || this.text().split('\n').length > 6);
}
