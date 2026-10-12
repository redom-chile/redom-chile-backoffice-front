import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from 'src/ui';
import { InventoryLocationStore } from '../../data-access';

/**
 * Selector del local de inventario (cada local tiene su stock). Usa el InventoryLocationStore,
 * así que el local elegido se comparte entre pantallas y se recuerda.
 */
@Component({
  selector: 'app-location-select',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="flex items-center gap-2 text-sm">
      <app-icon class="text-muted-foreground h-5 w-5" aria-hidden="true">storefront</app-icon>
      <span class="sr-only">Local</span>
      <select
        aria-label="Local"
        class="glass-input w-full rounded-md px-3 py-2 sm:w-56"
        [disabled]="disabled() || store.$isLoading() || store.$locations().length === 0"
        (change)="onChange($event)">
        @if (store.$isLoading() && store.$locations().length === 0) {
        <option>Cargando locales…</option>
        } @else if (store.$locations().length === 0) {
        <option>Sin locales</option>
        }
        @for (location of store.$locations(); track location.id) {
        <option [value]="location.id" [selected]="location.id === store.$locationId()">{{ location.name }}</option>
        }
      </select>
    </label>
  `,
})
export class LocationSelectComponent {
  protected readonly store = inject(InventoryLocationStore);
  readonly disabled = input(false);

  onChange(event: Event) {
    this.store.select(Number((event.target as HTMLSelectElement).value));
  }
}
