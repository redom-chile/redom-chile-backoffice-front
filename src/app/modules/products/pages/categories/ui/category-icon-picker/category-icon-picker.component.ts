import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { MENU_CATEGORY_ICONS } from 'src/app/modules/public-menu/data-access';
import { CartaIcon, CartaIconName } from 'src/app/modules/public-menu/carta/ui/carta-icon';
import { PlanLockBadgeComponent } from 'src/app/modules/products/shared';

const LABELS = new Map<string, string>(MENU_CATEGORY_ICONS.map((icon) => [icon.name, icon.label]));

export function categoryIconLabel(name: string | null | undefined): string | null {
  return name ? (LABELS.get(name) ?? null) : null;
}

/** Ícono de la categoría en las listas (nada si no tiene o no es de la lista). */
@Component({
  selector: 'app-category-icon-badge',
  imports: [CartaIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if ($label(); as label) {
    <span class="bg-primary/10 text-primary inline-flex size-7 shrink-0 items-center justify-center rounded-lg" [title]="'Ícono: ' + label">
      <app-carta-icon [name]="$name()" [size]="16" />
      <span class="sr-only">Ícono: {{ label }}</span>
    </span>
    }
  `,
})
export class CategoryIconBadgeComponent {
  readonly icon = input<string | null | undefined>(null);
  protected readonly $label = computed(() => categoryIconLabel(this.icon()));
  protected readonly $name = computed(() => (this.icon() ?? '') as CartaIconName);
}

/** Selector del ícono de la categoría en la carta (null = sin ícono). */
@Component({
  selector: 'app-category-icon-picker',
  imports: [CartaIcon, PlanLockBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [disabled]="locked()">
      <legend class="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        Ícono en la carta
        @if (locked()) {
        <app-plan-lock-badge feature="menu_design" />
        }
      </legend>
      <div
        role="radiogroup"
        aria-label="Ícono en la carta"
        class="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-5"
        [class.opacity-60]="locked()">
        <button type="button" role="radio" [attr.aria-checked]="value() === null" [class]="optionClass(value() === null)" (click)="value.set(null)">
          <span class="text-muted-foreground inline-flex h-5 items-center text-lg leading-none" aria-hidden="true">—</span>
          <span class="text-xs">Sin ícono</span>
        </button>
        @for (icon of icons; track icon.name) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="value() === icon.name"
          [class]="optionClass(value() === icon.name)"
          (click)="value.set(icon.name)">
          <app-carta-icon [name]="asName(icon.name)" [size]="20" />
          <span class="w-full truncate text-xs">{{ icon.label }}</span>
        </button>
        }
      </div>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        @if (locked()) { Los íconos son parte del diseño de la carta. } @else { Se muestra junto al nombre de la categoría en la carta. }
      </p>
    </fieldset>
  `,
})
export class CategoryIconPickerComponent {
  readonly value = model<string | null>(null);
  // Sin la función menu_design del plan: se ve, pero no se puede cambiar.
  readonly locked = input(false);
  protected readonly icons = MENU_CATEGORY_ICONS;
  protected readonly asName = (name: string) => name as CartaIconName;

  protected optionClass(selected: boolean): string {
    const base =
      'flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
    return selected
      ? `${base} border-primary bg-primary/10 text-primary`
      : `${base} border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700`;
  }
}
