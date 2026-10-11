import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { HeaderDashboardComponent, ButtonComponent, IconComponent, CardComponent, ToastService } from 'src/ui';

import { TablesTableComponent, TablesGridComponent, CreateTableModalComponent, SectorTabsComponent } from './features';

import {
  GetAllTablesService,
  CreateTableService,
  UpdateTableService,
  DeleteTableService,
  TableDto,
} from './data-access';
import { printTableQrs } from './ui';

import { BusinessLocationSelector } from 'src/app/modules/sectors/pages/sector-list/ui';
import { GetAllSectorsService } from 'src/app/modules/sectors/pages/sector-list/data-access';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-table-list',

  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    CardComponent,
    TablesTableComponent,
    TablesGridComponent,
    BusinessLocationSelector,
    SectorTabsComponent,
    CheckPermissionDirective,
  ],

  templateUrl: './table-list.component.html',
})
export class TableListComponent implements OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly access = inject(AccessService);

  protected readonly PERMISSIONS = PERMISSIONS;

  protected readonly $getAll = inject(GetAllTablesService);
  protected readonly $sectorsService = inject(GetAllSectorsService);

  protected readonly $createService = inject(CreateTableService);
  protected readonly $updateService = inject(UpdateTableService);
  protected readonly $deleteService = inject(DeleteTableService);

  protected readonly $tables = this.$getAll.$tables;
  protected readonly $sectors = this.$sectorsService.$sectors;

  protected readonly $isLoading = this.$getAll.$isLoading;
  protected readonly $hasError = this.$getAll.$hasError;

  protected readonly $viewMode = signal<'table' | 'grid'>('grid');
  protected readonly $selectedSectorId = signal<number | null>(null);

  protected readonly $filteredTables = computed(() => {
    const tables = this.$tables();
    const sectorId = this.$selectedSectorId();
    if (sectorId === null) return tables;
    return tables.filter((t) => t.sectorId === sectorId);
  });

  constructor() {
    effect(() => {
      if (this.$createService.$success()) {
        this.$getAll.retry();
      }

      if (this.$updateService.$success()) {
        this.$getAll.retry();
      }

      if (this.$deleteService.$success()) {
        this.$getAll.retry();
      }
    });
  }

  createTable() {
    this.dialog.open(CreateTableModalComponent, {
      width: '90%',
    });
  }

  toggleView() {
    this.$viewMode.update((v) => (v === 'grid' ? 'table' : 'grid'));
  }

  onLocationSelected(locationId: number) {
    this.$getAll.setParams(locationId);
    this.$sectorsService.setParams({ locationId });
    this.$selectedSectorId.set(null);
  }

  onTableSelected(table: TableDto) {
    const locationId = this.$getAll.getCurrentLocationId();
    // Con un pedido abierto, la mesa lleva directo a ese pedido (el más reciente si la comparten).
    if (table.currentTransactionId) {
      this.router.navigate(['/orders', table.currentTransactionId]);
      return;
    }
    if (table.status === 'blocked') {
      this.toast.show(`${table.name} está bloqueada`, 'warning');
      return;
    }
    // Ocupada sin pedido abierto informado (datos desfasados): se muestran sus pedidos abiertos.
    if (table.status === 'occupied') {
      this.toast.show(`No se encontró el pedido abierto de ${table.name}`, 'warning');
      this.router.navigate(['/orders'], { queryParams: { location: locationId, table: table.id, status: 'ORDERED' } });
      return;
    }
    if (!this.access.can(PERMISSIONS.ORDERS.CREATE_ORDER)) {
      this.toast.show('No tienes permiso para crear pedidos', 'warning');
      return;
    }
    this.router.navigate(['/orders/new'], {
      queryParams: { location: locationId, table: table.id },
    });
  }

  onSectorSelected(sectorId: number | null) {
    this.$selectedSectorId.set(sectorId);
  }

  retry() {
    this.$getAll.retry();
  }

  async printAllQrs() {
    const sectorNames = new Map(this.$sectors().map((sector) => [sector.id, sector.name]));
    const printable = this.$filteredTables()
      .filter((table) => table.qrUrl)
      .map((table) => ({
        name: table.name,
        detail: [table.sectorId ? sectorNames.get(table.sectorId) : null, `${table.capacity} personas`].filter(Boolean).join(' · '),
        url: table.qrUrl!,
      }));
    if (!printable.length) {
      this.toast.show('No hay mesas con QR disponible para imprimir', 'warning');
      return;
    }
    const opened = await printTableQrs(printable);
    if (!opened) this.toast.show('Permite las ventanas emergentes para imprimir', 'warning');
  }

  ngOnDestroy(): void {
    this.$createService.reset();
    this.$updateService.reset();
    this.$deleteService.reset();
  }
}
