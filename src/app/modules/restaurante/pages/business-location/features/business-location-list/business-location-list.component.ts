import { Component, computed, inject, input, output } from '@angular/core';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { PlanLockedBadgeComponent } from 'src/app/shared/components/plan-limit';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { ButtonComponent, ProgressBarComponent, TableComponent, SlotDirective } from 'src/ui';
import { BusinessLocationDto } from '../../data-access';

@Component({
  selector: 'app-business-location-list',
  imports: [TableComponent, SlotDirective, ButtonComponent, ProgressBarComponent, PlanLockedBadgeComponent, CheckPermissionDirective],
  templateUrl: './business-location-list.component.html',
  styleUrl: './business-location-list.component.css',
})
export class BusinessLocationListComponent {
  readonly $locations = input.required<BusinessLocationDto[]>({ alias: 'locations' });
  readonly isLoading = input(false, { alias: 'isLoading' });
  readonly togglingId = input<number | null>(null);
  readonly #entitlements = inject(EntitlementsService);
  readonly #access = inject(AccessService);
  protected readonly PERMISSIONS = PERMISSIONS;
  // Activar/desactivar usa el mismo permiso que editar.
  protected readonly $canUpdate = computed(() => this.#access.can(PERMISSIONS.LOCATIONS.UPDATE_LOCATION));

  readonly update = output<BusinessLocationDto>();
  readonly delete = output<BusinessLocationDto>();
  readonly toggleActive = output<BusinessLocationDto>();

  readonly headerData = ['Nombre', 'Ciudad', 'País', 'Dirección', 'Acción'];

  onUpdate(item: BusinessLocationDto) { this.update.emit(item); }
  onDelete(item: BusinessLocationDto) { this.delete.emit(item); }
  isLocked(item: BusinessLocationDto) { return this.#entitlements.isLocked('locations', item.id); }
}
