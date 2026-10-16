import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { cartaOpenDialogs } from '../carta-embed';
import { CartaI18n } from '../carta-i18n';
import { CartaIcon } from './carta-icon';

/** Bloquea el desplazamiento de la página mientras haya algún diálogo abierto (pueden encadenarse). */
let openDialogs = 0;
let previousOverflow = '';
function lockScroll(lock: boolean): void {
  const root = document.documentElement;
  if (lock && openDialogs++ === 0) {
    previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
  } else if (!lock && openDialogs > 0 && --openDialogs === 0) {
    root.style.overflow = previousOverflow;
  }
  // Incrustada (?embed=1): con un diálogo abierto la carta pide un alto mínimo al widget
  cartaOpenDialogs.set(openDialogs);
}

/**
 * Diálogo nativo (<dialog> modal: foco atrapado, Esc y fondo inerte). En móvil es una hoja inferior; desde sm, centrado.
 * Se abre al crearse: el padre lo muestra con @if y lo quita en (closed).
 */
@Component({
  selector: 'app-carta-dialog',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="carta-dialog fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-background p-0 text-foreground shadow-2xl outline-none backdrop:bg-black/60 sm:inset-y-0 sm:my-auto sm:h-fit sm:max-w-lg sm:rounded-3xl"
      [attr.aria-label]="label()"
      (close)="closed.emit()"
      (click)="onBackdrop($event)"
    >
      <button
        type="button"
        class="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border backdrop-blur transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
        [attr.aria-label]="t('common.close')"
        (click)="close()"
      >
        <app-carta-icon name="x" [size]="18" />
      </button>
      <div class="carta-dialog-body max-h-[92dvh] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <ng-content />
      </div>
    </dialog>
  `,
})
export class CartaDialog {
  readonly label = input.required<string>();
  readonly closed = output<void>();
  protected readonly t = inject(CartaI18n).t;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    let locked = false;
    afterNextRender(() => {
      const el = this.dialog().nativeElement;
      try {
        el.showModal();
      } catch {
        el.setAttribute('open', '');
      }
      lockScroll(true);
      locked = true;
    });
    inject(DestroyRef).onDestroy(() => {
      if (locked) lockScroll(false);
    });
  }

  close(): void {
    const el = this.dialog().nativeElement;
    if (el.open) el.close();
    else this.closed.emit();
  }

  /** Un clic directo sobre el <dialog> es un clic en el fondo. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
