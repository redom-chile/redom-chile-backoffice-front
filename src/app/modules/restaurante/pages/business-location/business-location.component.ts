import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { PLAN_LIMIT_REACHED_TOOLTIP, PlanLockedNoticeComponent, PlanUsageComponent, planLimitGate } from 'src/app/shared/components/plan-limit';
import { HeaderDashboardComponent, ButtonComponent, EmptyStateComponent, ToastService } from 'src/ui';
import { BusinessLocationListComponent } from './features/business-location-list';
import {
  CreateBusinessLocationModalComponent,
  UpdateBusinessLocationModalComponent,
  DeleteBusinessLocationModalComponent,
} from './features';
import {
  GetAllBusinessLocationsService,
  CreateBusinessLocationService,
  UpdateBusinessLocationService,
  DeleteBusinessLocationService,
  ActivateDeactivateBusinessLocationService,
  BusinessLocationDto,
} from './data-access';

@Component({
  selector: 'app-business-location',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    EmptyStateComponent,
    BusinessLocationListComponent,
    PlanUsageComponent,
    PlanLockedNoticeComponent,
  ],
  templateUrl: './business-location.component.html',
  styleUrl: './business-location.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessLocationComponent implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  protected readonly $getAll = inject(GetAllBusinessLocationsService);
  protected readonly $createService = inject(CreateBusinessLocationService);
  protected readonly $updateService = inject(UpdateBusinessLocationService);
  protected readonly $deleteService = inject(DeleteBusinessLocationService);
  protected readonly $activateService = inject(ActivateDeactivateBusinessLocationService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #toast = inject(ToastService);
  protected readonly limitGate = planLimitGate('max_locations');
  protected readonly limitTooltip = PLAN_LIMIT_REACHED_TOOLTIP;
  #toggling: BusinessLocationDto | null = null;

  protected get togglingId(): number | null {
    return this.#toggling?.id ?? null;
  }

  protected readonly $locations = this.$getAll.$locations;
  protected readonly $isLoading = this.$getAll.$isLoading;
  protected readonly $hasError = this.$getAll.$hasError;

  constructor() {
    effect(() => {
      if (this.$createService.$success()) this.$getAll.retry();
      if (this.$updateService.$success()) this.$getAll.retry();
      if (this.$deleteService.$success()) this.$getAll.retry();
      // Crear o eliminar cambia el uso del plan.
      if (this.$createService.$success() || this.$deleteService.$success()) untracked(() => this.#entitlements.refresh());
    });

    effect(() => {
      const item = this.#toggling;
      if (this.$activateService.$success() && item) {
        untracked(() => {
          this.#toast.show(item.isActive === false ? 'Sucursal activada' : 'Sucursal desactivada', 'success');
          this.#entitlements.refresh();
          this.$getAll.retry();
        });
      }
      if (this.$activateService.$hasError()) untracked(() => this.#toast.show('No se pudo actualizar la sucursal', 'error'));
    });
  }

  createBusinessLocation() {
    if (!this.limitGate.allow()) return;
    // Primera sucursal: se sugiere el nombre del negocio.
    const isFirst = (this.$locations() ?? []).length === 0;
    const suggestedName = isFirst ? (this.#settings.$settings()?.name ?? '') : '';
    this.dialog.open(CreateBusinessLocationModalComponent, { width: '90%', data: { suggestedName } });
  }

  updateBusinessLocation(item: BusinessLocationDto) {
    this.dialog.open(UpdateBusinessLocationModalComponent, { width: '90%', data: item });
  }

  deleteBusinessLocation(item: BusinessLocationDto) {
    this.dialog.open(DeleteBusinessLocationModalComponent, { width: '90%', data: item });
  }

  // Activar ocupa un local del plan (el backend puede responder PLAN_LIMIT_REACHED: lo muestra el modal global).
  toggleBusinessLocation(item: BusinessLocationDto) {
    if (this.$activateService.$isLoading()) return;
    if (item.isActive === false && !this.limitGate.allow()) return;
    this.#toggling = item;
    this.$activateService.reset();
    this.$activateService.toggle(item.id);
  }

  retry() {
    this.$getAll.retry();
  }

  ngOnDestroy(): void {
    this.$createService.reset();
    this.$updateService.reset();
    this.$deleteService.reset();
    this.$activateService.reset();
  }
}
