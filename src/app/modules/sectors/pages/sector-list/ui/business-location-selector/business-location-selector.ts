import { booleanAttribute, Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';
import { EntitlementsService } from 'src/app/core/services/entitlements';

@Component({
  selector: 'app-business-location-selector',
  imports: [FormsModule, RouterLink],
  template: `
    @if ($isLoading()) {

    <div class="bg-muted h-[42px] w-full animate-pulse rounded-lg"></div>

    } @else if ($locations()?.length === 0) {

    <!-- Sin sucursales: en vez de un select vacío, se invita a crear la primera -->
    <div class="glass-input flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm">
      <span class="text-muted-foreground">No hay sucursales</span>
      <a routerLink="/business/location" class="text-primary font-medium hover:underline">Crear sucursal</a>
    </div>

    } @else {

    <select
      class="glass-input w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
      [(ngModel)]="selectedLocationId"
      (ngModelChange)="onLocationChange($event)">
      @for (location of ($locations() ?? []); track location.id) {
      @let locked = forSale() && isLocked(location.id);
      <option [ngValue]="location.id" [disabled]="locked">
        {{ location.name }}{{ locked ? ' (solo lectura)' : '' }}
      </option>
      }
    </select>
    }
  `,
})
export class BusinessLocationSelector {
  protected readonly $getAll = inject(GetAllBusinessLocationsService);

  protected readonly $locations = this.$getAll.$locations;
  private readonly $branchId = inject(WhoamiService).$branchId;
  readonly #entitlements = inject(EntitlementsService);
  /** Para vender (POS, nuevo pedido): los locales sobre el límite del plan quedan en solo lectura y no se eligen. */
  readonly forSale = input(false, { transform: booleanAttribute });
  #changedByUser = false;

  protected readonly $isLoading = this.$getAll.$isLoading;

  protected readonly $hasError = this.$getAll.$hasError;

  selectedLocationId: number | null = null;

  selectedLocationChange = output<number>();

  constructor() {
    // Por defecto, la sucursal del usuario; si no tiene (o ya no existe), la primera.
    effect(() => {
      const locations = this.$locations();
      if (!locations?.length || this.#changedByUser) return;
      const branchId = this.$branchId();
      const usable = this.forSale() ? locations.filter((location) => !this.isLocked(location.id)) : locations;
      const options = usable.length ? usable : locations;
      const preferred = options.find((location) => location.id === branchId)?.id ?? options[0].id;
      // Si todavía no se sabe quién es el usuario, se muestra la primera y se corrige al llegar el dato.
      if (this.selectedLocationId === preferred) return;
      if (this.selectedLocationId !== null && branchId === undefined) return;
      this.selectedLocationId = preferred;
      this.selectedLocationChange.emit(preferred);
    });
  }

  isLocked(id: number): boolean {
    return this.#entitlements.isLocked('locations', id);
  }

  onLocationChange(id: number) {
    if (id) {
      this.#changedByUser = true;
      this.selectedLocationId = id;
      this.selectedLocationChange.emit(id);
    }
  }
}
