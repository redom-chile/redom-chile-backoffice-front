import { Directive, ElementRef, inject, input } from '@angular/core';

/** Pestaña con tabindex móvil: la activa es la única que recibe foco con Tab. */
@Directive({
  selector: '[appTab]',
  host: {
    role: 'tab',
    '[attr.aria-selected]': 'appTab()',
    '[attr.tabindex]': 'appTab() ? 0 : -1',
    '[attr.aria-controls]': 'appTab() ? tabPanel() : null',
  },
})
export class TabDirective {
  /** true si es la pestaña activa. */
  readonly appTab = input.required<boolean>();
  /** id del panel que muestra (solo existe el de la activa). */
  readonly tabPanel = input<string | null>(null);
}

/** Lista de pestañas: flechas izquierda/derecha, Inicio y Fin mueven el foco y seleccionan la pestaña. */
@Directive({
  selector: '[appTabList]',
  host: { role: 'tablist', '(keydown)': 'onKeydown($event)' },
})
export class TabListDirective {
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);

  onKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(this.#host.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
      (tab) => !tab.hasAttribute('disabled'),
    );
    if (!tabs.length) return;
    const current = tabs.indexOf(this.#host.nativeElement.ownerDocument.activeElement as HTMLElement);
    const last = tabs.length - 1;
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : event.key === 'ArrowRight' ? (current < 0 || current === last ? 0 : current + 1)
      : current <= 0 ? last
      : current - 1;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }
}
