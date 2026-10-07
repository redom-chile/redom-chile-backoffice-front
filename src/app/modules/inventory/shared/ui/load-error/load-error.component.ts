import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent, IconComponent } from 'src/ui';
import { getInventoryErrorMessage, isInventoryDisabledError } from '../../../data-access';
import { InventoryDisabledComponent } from '../../../ui';

/** Error de carga de inventario: 409 → "Activar inventario"; el resto, mensaje y reintentar. */
@Component({
  selector: 'app-inventory-load-error',
  imports: [ButtonComponent, IconComponent, InventoryDisabledComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if ($isDisabled()) {
    <app-inventory-disabled />
    } @else {
    <div class="flex flex-col items-center gap-4 py-16 text-center">
      <app-icon class="text-destructive h-14 w-14">error_outline</app-icon>
      <div>
        <h2 class="text-foreground text-lg font-semibold">{{ title() }}</h2>
        <p class="text-muted-foreground mt-1 text-sm">{{ $message() }}</p>
      </div>
      <app-button type="button" impact="bold" tone="primary" shape="rounded" (buttonClick)="retry.emit()">Reintentar</app-button>
    </div>
    }
  `,
})
export class LoadErrorComponent {
  readonly error = input.required<unknown>();
  readonly title = input('No se pudo cargar la información');
  readonly retry = output<void>();

  readonly $isDisabled = computed(() => isInventoryDisabledError(this.error()));
  readonly $message = computed(() => getInventoryErrorMessage(this.error()));
}
