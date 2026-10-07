import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent, IconComponent } from 'src/ui';

/** Estado del 409 "Inventory is not enabled": lleva a Mi negocio → pestaña Inventario. */
@Component({
  selector: 'app-inventory-disabled',
  imports: [EmptyStateComponent, IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-empty-state
      icon="inventory"
      title="El inventario no está activado"
      description="Actívalo para controlar el stock de cada local, registrar compras y mermas, y ver el costo de lo que tienes.">
      <a
        routerLink="/business"
        [queryParams]="{ tab: 'inventario' }"
        class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90">
        <app-icon class="h-5 w-5">settings</app-icon>
        Activar inventario
      </a>
    </app-empty-state>
  `,
})
export class InventoryDisabledComponent {}
