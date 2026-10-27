import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, IconComponent, ImageThumbComponent } from 'src/ui';
import { CategoryDto } from '../../data-access';
import { CategoryIconBadgeComponent } from '../../ui';

/** Fila de la lista ordenable (el asa de arrastre la pone la lista, que es la dueña del cdkDrag). */
@Component({
  selector: 'app-category-order-row',
  imports: [ButtonComponent, IconComponent, ImageThumbComponent, CheckPermissionDirective, CategoryIconBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-1 items-center gap-2' },
  template: `
    @let item = category();
    <app-image-thumb
      class="bg-primary/10 text-primary size-8 shrink-0 text-xs"
      [src]="item.imageUrl"
      [name]="item.name"
      [alt]="item.name"
      (expired)="imageExpired.emit()" />
    <app-category-icon-badge [icon]="item.icon" />
    <div class="min-w-0 flex-1">
      <p class="text-foreground truncate text-sm font-medium">{{ item.name }}</p>
      @if (item.shortCode) {
      <p class="text-muted-foreground truncate font-mono text-xs">{{ item.shortCode }}</p>
      }
    </div>
    @if (showMove()) {
    <div class="flex shrink-0 items-center">
      <button
        type="button"
        [class]="moveClass"
        [disabled]="moveDisabled() || isFirst()"
        [attr.aria-label]="'Subir ' + item.name"
        title="Subir"
        (click)="up.emit()">
        <app-icon class="h-5 w-5">keyboard_arrow_up</app-icon>
      </button>
      <button
        type="button"
        [class]="moveClass"
        [disabled]="moveDisabled() || isLast()"
        [attr.aria-label]="'Bajar ' + item.name"
        title="Bajar"
        (click)="down.emit()">
        <app-icon class="h-5 w-5">keyboard_arrow_down</app-icon>
      </button>
    </div>
    }
    <div class="flex shrink-0 items-center gap-1">
      <app-button *appCheckPermission="PERMISSIONS.CATEGORIES.UPDATE_CATEGORY" size="small" icon="edit_document" (buttonClick)="edit.emit()" />
      <app-button
        *appCheckPermission="PERMISSIONS.CATEGORIES.DELETE_CATEGORY"
        size="small"
        icon="delete"
        tone="danger"
        (buttonClick)="remove.emit()" />
    </div>
  `,
})
export class CategoryOrderRowComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  protected readonly moveClass =
    'text-muted-foreground hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-[var(--muted)]/30 disabled:opacity-30';
  readonly category = input.required<CategoryDto>();
  readonly showMove = input(false);
  readonly moveDisabled = input(false);
  readonly isFirst = input(false);
  readonly isLast = input(false);
  readonly up = output<void>();
  readonly down = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly imageExpired = output<void>();
}
