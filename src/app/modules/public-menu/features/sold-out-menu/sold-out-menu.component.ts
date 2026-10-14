import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ClickOutsideDirective, IconComponent } from 'src/ui';
import { SoldOutChoice } from './sold-out-time';

/** Botón "Agotar" con sus opciones (hasta el cierre, hasta mañana, hasta que lo active) y "Ocultar en este local". */
@Component({
  selector: 'app-sold-out-menu',
  imports: [IconComponent, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-block' },
  template: `
    <div (clickOutside)="$open.set(false)">
      <button
        type="button"
        class="bg-destructive/15 text-destructive hover:bg-destructive/25 inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium disabled:opacity-50"
        [disabled]="disabled()"
        [attr.aria-expanded]="$open()"
        aria-haspopup="menu"
        (click)="$open.set(!$open())">
        <app-icon class="h-4 w-4" aria-hidden="true">block</app-icon>{{ label() }}
        <app-icon class="h-4 w-4" aria-hidden="true">expand_more</app-icon>
      </button>
      @if ($open()) {
      <div
        role="menu"
        class="glass absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--border)] py-1 shadow-lg">
        @for (option of options; track option.value) {
        <button type="button" role="menuitem" class="hover:bg-primary/10 text-foreground flex w-full flex-col px-3 py-2 text-left text-sm" (click)="pick(option.value)">
          <span class="font-medium">{{ option.label }}</span>
          <span class="text-muted-foreground text-xs">{{ option.hint }}</span>
        </button>
        }
        @if (canHide()) {
        <div class="my-1 border-t border-[var(--border)]"></div>
        <button type="button" role="menuitem" class="hover:bg-primary/10 text-foreground flex w-full flex-col px-3 py-2 text-left text-sm" (click)="pick('hide')">
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

  readonly $open = signal(false);

  readonly options: ReadonlyArray<{ value: SoldOutChoice; label: string; hint: string }> = [
    { value: 'until-close', label: 'Hasta el cierre', hint: 'Vuelve solo mañana' },
    { value: 'until-tomorrow', label: 'Hasta mañana', hint: 'Vuelve mañana a las 06:00' },
    { value: 'until-enabled', label: 'Hasta que lo active', hint: 'Lo marcas disponible tú' },
  ];

  pick(choice: SoldOutChoice) {
    this.$open.set(false);
    this.choose.emit(choice);
  }
}
