import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, Injector, inject, input, output, signal, viewChild } from '@angular/core';
import { ClickOutsideDirective, IconComponent } from 'src/ui';
import { SoldOutChoice } from './sold-out-time';

let nextId = 0;

/** Botón "Agotar" con sus opciones (hasta el cierre, hasta mañana, hasta que lo active) y "Ocultar en este local". */
@Component({
  selector: 'app-sold-out-menu',
  imports: [IconComponent, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-block' },
  template: `
    <div (clickOutside)="$open.set(false)" (keydown.escape)="close(true)">
      <button
        #trigger
        type="button"
        class="bg-destructive/15 text-destructive hover:bg-destructive/25 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium disabled:opacity-50"
        [disabled]="disabled()"
        [attr.aria-expanded]="$open()"
        aria-haspopup="menu"
        [attr.aria-controls]="$open() ? menuId : null"
        (click)="toggle()">
        <app-icon class="h-4 w-4" aria-hidden="true">block</app-icon>{{ label() }}
        <app-icon class="h-4 w-4" aria-hidden="true">expand_more</app-icon>
      </button>
      @if ($open()) {
      <div
        #menu
        role="menu"
        [id]="menuId"
        class="glass absolute z-20 w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-[var(--border)] py-1 shadow-lg"
        [class]="[$alignLeft() ? 'left-0' : 'right-0', $openUp() ? 'bottom-full mb-1' : 'top-full mt-1']"
        (keydown)="onMenuKeydown($event)">
        @for (option of options; track option.value) {
        <button type="button" role="menuitem" tabindex="-1" class="hover:bg-primary/10 focus:bg-primary/10 focus:outline-none text-foreground flex w-full flex-col px-3 py-2 text-left text-sm" (click)="pick(option.value)">
          <span class="font-medium">{{ option.label }}</span>
          <span class="text-muted-foreground text-xs">{{ option.hint }}</span>
        </button>
        }
        @if (canHide()) {
        <div class="my-1 border-t border-[var(--border)]"></div>
        <button type="button" role="menuitem" tabindex="-1" class="hover:bg-primary/10 focus:bg-primary/10 focus:outline-none text-foreground flex w-full flex-col px-3 py-2 text-left text-sm" (click)="pick('hide')">
          <span class="font-medium">Ocultar en este local</span>
          <span class="text-muted-foreground text-xs">Para lo que este local no vende</span>
        </button>
        }
      </div>
      }
    </div>
  `,
})
export class SoldOutMenuComponent {
  readonly label = input('Agotar');
  readonly disabled = input(false);
  readonly canHide = input(true);
  readonly choose = output<SoldOutChoice>();

  readonly #injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  readonly menuId = `sold-out-menu-${nextId++}`;
  readonly $open = signal(false);
  readonly $alignLeft = signal(false);
  readonly $openUp = signal(false);

  readonly options: ReadonlyArray<{ value: SoldOutChoice; label: string; hint: string }> = [
    { value: 'until-close', label: 'Hasta el cierre', hint: 'Vuelve solo mañana' },
    { value: 'until-tomorrow', label: 'Hasta mañana', hint: 'Vuelve mañana a las 06:00' },
    { value: 'until-enabled', label: 'Hasta que lo active', hint: 'Lo marcas disponible tú' },
  ];

  toggle() {
    if (this.$open()) return this.close(false);
    this.$alignLeft.set(false);
    this.$openUp.set(false);
    this.$open.set(true);
    afterNextRender(() => this.#placeAndFocus(), { injector: this.#injector });
  }

  close(returnFocus: boolean) {
    if (!this.$open()) return;
    this.$open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  pick(choice: SoldOutChoice) {
    this.close(true);
    this.choose.emit(choice);
  }

  onMenuKeydown(event: KeyboardEvent) {
    const items = this.#items();
    if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key)) return;
    if (event.key === 'Tab') return this.close(false);
    event.preventDefault();
    const current = items.indexOf(items[0].ownerDocument.activeElement as HTMLElement);
    const last = items.length - 1;
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : event.key === 'ArrowDown' ? (current >= last ? 0 : current + 1)
      : current <= 0 ? last
      : current - 1;
    items[next].focus();
  }

  #items(): HTMLElement[] {
    return Array.from(this.menu()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  /** Mantiene el menú dentro de la pantalla (en teléfonos el botón puede quedar a la izquierda o abajo). */
  #placeAndFocus() {
    const menu = this.menu()?.nativeElement;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    if (rect.left < 8) this.$alignLeft.set(true);
    const trigger = this.trigger().nativeElement.getBoundingClientRect();
    if (rect.bottom > (menu.ownerDocument.defaultView?.innerHeight ?? Infinity) - 8 && trigger.top - rect.height - 8 > 0) this.$openUp.set(true);
    this.#items()[0]?.focus();
  }
}
