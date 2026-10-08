import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { EntitlementsService, isPlanError } from 'src/app/core/services/entitlements';
import {
  PLAN_LIMIT_REACHED_TOOLTIP,
  PlanLockedBadgeComponent,
  PlanLockedNoticeComponent,
  PlanUsageComponent,
  planLimitGate,
} from 'src/app/shared/components/plan-limit';
import { hasApiErrorCode } from 'src/app/core/utils/api-error';
import { CashRegisterDto, CashService, getCashErrorMessage } from 'src/app/modules/cash/data-access';
import { formatTime } from 'src/app/modules/cash/ui';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';
import { RegisterModalComponent, RegisterModalData, RegisterModalResult } from './features';

type LocationGroup = Readonly<{ locationId: number; locationName: string; registers: CashRegisterDto[] }>;
type LocationOption = Readonly<{ id: number; name: string }>;

/** Configuración → Cajas: cajas por local, crear, renombrar y activar/desactivar. Funciona con el módulo apagado. */
@Component({
  selector: 'app-cash-registers',
  imports: [
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    ToggleComponent,
    PlanUsageComponent,
    PlanLockedNoticeComponent,
    PlanLockedBadgeComponent,
  ],
  templateUrl: './cash-registers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashRegistersComponent {
  readonly #cash = inject(CashService);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #locations = inject(GetAllBusinessLocationsService);
  readonly #entitlements = inject(EntitlementsService);
  readonly limitGate = planLimitGate('max_registers');
  readonly limitTooltip = PLAN_LIMIT_REACHED_TOOLTIP;

  readonly formatTime = formatTime;
  readonly $includeInactive = signal(false);
  readonly $busyIds = signal<ReadonlySet<number>>(new Set());
  readonly $isModuleOff = computed(() => this.#settings.$isLoaded() && !this.#settings.$cashManagementEnabled());

  readonly registers = rxResource({
    params: () => ({ includeInactive: this.$includeInactive() }),
    stream: ({ params }) => this.#cash.getRegisters(params).pipe(toRemoteResult()),
  });

  readonly #list = computed(() => resultValue(this.registers.value()));
  readonly $error = computed(() => resultError(this.registers.value()));
  readonly $errorMessage = computed(() => getCashErrorMessage(this.$error(), 'No se pudieron cargar las cajas.'));
  readonly $isFirstLoad = computed(() => this.registers.isLoading() && !this.#list());

  // Locales para crear: los del negocio; si no cargan, los que ya tienen cajas.
  readonly $locationOptions = computed<LocationOption[]>(() => {
    const locations = this.#locations.$locations();
    if (locations?.length) return locations.map((location) => ({ id: location.id, name: location.name }));
    const seen = new Map<number, string>();
    for (const register of this.#list() ?? []) seen.set(register.locationId, register.locationName);
    return [...seen].map(([id, name]) => ({ id, name }));
  });

  readonly $groups = computed<LocationGroup[]>(() => {
    const groups = new Map<number, LocationGroup>();
    for (const register of this.#list() ?? []) {
      const group = groups.get(register.locationId) ?? { locationId: register.locationId, locationName: register.locationName, registers: [] };
      group.registers.push(register);
      groups.set(register.locationId, group);
    }
    return [...groups.values()].sort((a, b) => a.locationName.localeCompare(b.locationName, 'es'));
  });

  isBusy(id: number): boolean {
    return this.$busyIds().has(id);
  }

  isLocked(register: CashRegisterDto): boolean {
    return this.#entitlements.isLocked('registers', register.id);
  }

  create(locationId: number | null = null) {
    if (!this.limitGate.allow()) return;
    this.#open({ locations: this.$locationOptions(), locationId });
  }

  rename(register: CashRegisterDto) {
    this.#open({ register, locations: this.$locationOptions() });
  }

  setActive(register: CashRegisterDto, isActive: boolean) {
    if (this.isBusy(register.id)) return;
    // Activar ocupa una caja del plan.
    if (isActive && !this.limitGate.allow()) return;
    this.#setBusy(register.id, true);
    this.#cash.updateRegister(register.id, { isActive }).subscribe({
      next: () => {
        this.#setBusy(register.id, false);
        this.#toast.show(isActive ? `${register.name} activada` : `${register.name} desactivada`, 'success');
        this.#entitlements.refresh();
        this.registers.reload();
      },
      error: (error: unknown) => {
        this.#setBusy(register.id, false);
        this.registers.reload();
        // El error de plan ya muestra su modal.
        if (isPlanError(error)) return;
        const message = hasApiErrorCode(error, 'CASH_SESSION_ALREADY_OPEN')
          ? 'Cierra el turno abierto de esta caja antes de desactivarla.'
          : getCashErrorMessage(error, 'No se pudo actualizar la caja.');
        this.#toast.show(message, 'error');
      },
    });
  }

  #open(data: RegisterModalData) {
    this.#dialog
      .open<RegisterModalComponent, RegisterModalData, RegisterModalResult>(RegisterModalComponent, {
        width: '480px',
        maxWidth: '95vw',
        disableClose: true,
        data,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result !== 'created' && result !== 'updated') return;
        this.#toast.show(result === 'created' ? 'Caja creada' : 'Caja renombrada', 'success');
        if (result === 'created') this.#entitlements.refresh();
        this.registers.reload();
      });
  }

  #setBusy(id: number, busy: boolean) {
    this.$busyIds.update((ids) => {
      const next = new Set(ids);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
