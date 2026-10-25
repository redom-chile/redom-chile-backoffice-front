import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from 'src/ui';
import { STAGE_MISSING_MESSAGE } from './menu-dynamic-errors';

/** Aviso cuando el servidor aún no tiene la etapa 11: las acciones quedan deshabilitadas. */
@Component({
  selector: 'app-menu-dynamic-stage-banner',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-start gap-2 rounded-[1rem] border border-sky-500/40 bg-sky-500/10 p-3 text-sm" role="status">
      <app-icon class="h-5 w-5 shrink-0 text-sky-700 dark:text-sky-400" aria-hidden="true">info</app-icon>
      <p class="text-foreground">{{ message }}</p>
    </div>
  `,
})
export class MenuDynamicStageBannerComponent {
  readonly message = STAGE_MISSING_MESSAGE;
}

/** Botones subir/bajar de una lista ordenable (alternativa al arrastre, accesible con teclado). */
@Component({
  selector: 'app-menu-dynamic-move-buttons',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col' },
  template: `
    <button type="button" class="text-muted-foreground hover:text-foreground inline-flex h-6 w-8 items-center justify-center rounded disabled:opacity-30" [disabled]="disabled() || first()" [attr.aria-label]="'Subir ' + label()" (click)="moveUp.emit()">
      <app-icon class="h-5 w-5" aria-hidden="true">keyboard_arrow_up</app-icon>
    </button>
    <button type="button" class="text-muted-foreground hover:text-foreground inline-flex h-6 w-8 items-center justify-center rounded disabled:opacity-30" [disabled]="disabled() || last()" [attr.aria-label]="'Bajar ' + label()" (click)="moveDown.emit()">
      <app-icon class="h-5 w-5" aria-hidden="true">keyboard_arrow_down</app-icon>
    </button>
  `,
})
export class MenuDynamicMoveButtonsComponent {
  readonly label = input('');
  readonly first = input(false);
  readonly last = input(false);
  readonly disabled = input(false);
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
}
