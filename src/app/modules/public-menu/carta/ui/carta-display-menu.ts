import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { CartaDisplay, CartaThemeMode } from '../carta-display';
import { CartaI18n, CartaKey } from '../carta-i18n';
import { CartaIcon, CartaIconName } from './carta-icon';

/** Solo íconos; el nombre va en aria-label y title. */
const MODES: ReadonlyArray<{ value: CartaThemeMode; label: CartaKey; icon: CartaIconName }> = [
  { value: 'system', label: 'display.system', icon: 'monitor' },
  { value: 'light', label: 'display.light', icon: 'sun' },
  { value: 'dark', label: 'display.dark', icon: 'moon' },
];

/** Botón "Aa": modo claro/oscuro, alto contraste (si el local lo ofrece) y tamaño del texto de la carta. */
@Component({
  selector: 'app-carta-display-menu',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    <div class="relative">
      <button
        type="button"
        class="size-10 border-border bg-background/85 text-foreground hover:bg-muted focus-visible:outline-primary flex items-center justify-center rounded-full border shadow-sm backdrop-blur transition focus-visible:outline-2"
        [attr.aria-label]="t('display.label')"
        aria-controls="carta-display-panel"
        [attr.aria-expanded]="open()"
        (click)="open.update((v) => !v)">
        <span class="text-[0.95rem] font-semibold leading-none" aria-hidden="true"
          >A<span class="text-[0.7rem]">a</span></span
        >
      </button>
      @if (open()) {
      <div
        id="carta-display-panel"
        role="group"
        [attr.aria-label]="t('display.label')"
        class="border-border bg-card text-foreground absolute right-0 top-12 z-40 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-xl">
        @if (!display.modeLocked || contrast()) {
        <div class="flex gap-2">
        @if (!display.modeLocked) {
        <div class="bg-muted grid flex-1 grid-cols-3 gap-1 rounded-xl p-1">
          @for (m of modes; track m.value) {
          <button
            type="button"
            class="focus-visible:outline-primary flex h-9 items-center justify-center rounded-lg transition focus-visible:outline-2"
            [class]="
              display.mode() === m.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            [attr.aria-label]="t(m.label)"
            [attr.title]="t(m.label)"
            [attr.aria-pressed]="display.mode() === m.value"
            (click)="display.setMode(m.value)">
            <app-carta-icon [name]="m.icon" [size]="18" />
          </button>
          }
        </div>
        }
        @if (contrast()) {
        <button
          type="button"
          class="focus-visible:outline-primary flex h-11 shrink-0 items-center justify-center rounded-xl px-3 transition focus-visible:outline-2"
          [class]="display.highContrast() ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'"
          [class.flex-1]="display.modeLocked"
          [attr.aria-label]="t('display.contrast')"
          [attr.title]="t('display.contrast')"
          [attr.aria-pressed]="display.highContrast()"
          (click)="display.toggleContrast()">
          <app-carta-icon name="contrast" [size]="18" />
        </button>
        }
        </div>
        }
        <p
          class="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
          [class.mt-4]="!display.modeLocked || contrast()">
          {{ t('display.textSize') }}
        </p>
        <div class="mt-2 flex items-center gap-2">
          <button
            type="button"
            class="size-10 border-border hover:bg-muted focus-visible:outline-primary flex shrink-0 items-center justify-center rounded-xl border font-semibold transition focus-visible:outline-2 disabled:opacity-40"
            [attr.aria-label]="t('display.shrink')"
            [disabled]="!display.canShrink()"
            (click)="display.shrink()">
            <span class="text-sm" aria-hidden="true">A−</span>
          </button>
          <p class="flex-1 text-center text-sm font-semibold tabular-nums" aria-live="polite">{{ percent() }} %</p>
          <button
            type="button"
            class="size-10 border-border hover:bg-muted focus-visible:outline-primary flex shrink-0 items-center justify-center rounded-xl border font-semibold transition focus-visible:outline-2 disabled:opacity-40"
            [attr.aria-label]="t('display.grow')"
            [disabled]="!display.canGrow()"
            (click)="display.grow()">
            <span class="text-lg" aria-hidden="true">A+</span>
          </button>
        </div>
        @if (display.scale() !== 1) {
        <button
          type="button"
          class="text-primary hover:bg-muted mt-2 w-full rounded-lg py-1.5 text-sm font-medium"
          (click)="display.resetSize()">
          {{ t('display.reset') }}
        </button>
        }
      </div>
      }
    </div>
  `,
})
export class CartaDisplayMenu {
  protected readonly display = inject(CartaDisplay);
  protected readonly t = inject(CartaI18n).t;
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly modes = MODES;
  protected readonly open = signal(false);
  /** Etapa 8: el local ofrece alto contraste (design.accessibility.highContrast). */
  readonly contrast = input(false);

  protected percent(): number {
    return Math.round(this.display.scale() * 100);
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.#host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
