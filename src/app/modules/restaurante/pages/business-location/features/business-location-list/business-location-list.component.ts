import { Component, inject, input, output } from '@angular/core';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { PlanLockedBadgeComponent } from 'src/app/shared/components/plan-limit';
import { ButtonComponent, ProgressBarComponent, TableComponent, SlotDirective } from 'src/ui';
import { BusinessLocationDto } from '../../data-access';

@Component({
  selector: 'app-business-location-list',
  imports: [TableComponent, SlotDirective, ButtonComponent, ProgressBarComponent, PlanLockedBadgeComponent],
  templateUrl: './business-location-list.component.html',
  styleUrl: './business-location-list.component.css',
})
export class BusinessLocationListComponent {
  readonly $locations = input.required<BusinessLocationDto[]>({ alias: 'locations' });
  readonly isLoading = input(false, { alias: 'isLoading' });
  readonly togglingId = input<number | null>(null);
  readonly #entitlements = inject(EntitlementsService);

  readonly update = output<BusinessLocationDto>();
  readonly delete = output<BusinessLocationDto>();
  readonly toggleActive = output<BusinessLocationDto>();

  readonly headerData = ['Nombre', 'Ciudad', 'País', 'Dirección', 'Acción'];

  onUpdate(item: BusinessLocationDto) { this.update.emit(item); }
  onDelete(item: BusinessLocationDto) { this.delete.emit(item); }
  isLocked(item: BusinessLocationDto) { return this.#entitlements.isLocked('locations', item.id); }
}
