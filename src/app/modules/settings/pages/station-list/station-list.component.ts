import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { ComponentType } from '@angular/cdk/portal';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { GetAllPrintersService } from '../printer-list/data-access';
import { GetAllStationsService, getStationErrorMessage, StationDto } from './data-access';
import {
  CreateStationModalComponent,
  DeleteStationModalComponent,
  StationModalData,
  StationModalResult,
  StationProductsModalComponent,
  StationsGridComponent,
  UpdateStationModalComponent,
} from './features';

@Component({
  selector: 'app-station-list',
  standalone: true,
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, EmptyStateComponent, StationsGridComponent, CheckPermissionDirective],
  templateUrl: './station-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StationListComponent implements OnInit {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly getAllService = inject(GetAllStationsService);
  private readonly printersService = inject(GetAllPrintersService);
  private readonly locationsService = inject(GetAllBusinessLocationsService);

  readonly $stations = computed(() => this.getAllService.$stations() ?? []);
  readonly $printers = computed(() => this.printersService.$printers() ?? []);
  readonly $isLoading = computed(() => this.getAllService.$isLoading() ?? false);
  readonly $errorMessage = computed(() => {
    const status = this.getAllService.$error();
    return status ? getStationErrorMessage(status) : null;
  });
  readonly $isEmpty = computed(
    () => !this.$isLoading() && !this.$errorMessage() && this.getAllService.$stations() !== undefined && !this.$stations().length,
  );
  readonly $printerNames = computed(() => Object.fromEntries(this.$printers().map((printer) => [printer.id, printer.name])));
  readonly $locationNames = computed(() =>
    Object.fromEntries((this.locationsService.$locations() ?? []).map((location) => [location.id, location.name])),
  );

  ngOnInit(): void {
    this.getAllService.load();
    this.printersService.load();
  }

  handleRetry() {
    this.getAllService.load();
  }

  handleCreate() {
    this.openForm(CreateStationModalComponent, { printers: this.$printers() });
  }

  handleUpdate(station: StationDto) {
    this.openForm(UpdateStationModalComponent, { station, printers: this.$printers() });
  }

  handleDelete(station: StationDto) {
    this.dialog
      .open<DeleteStationModalComponent, StationDto, StationModalResult>(DeleteStationModalComponent, {
        width: '480px',
        maxWidth: '95vw',
        disableClose: true,
        data: station,
      })
      .afterClosed()
      .subscribe((result) => this.handleResult(result));
  }

  handleManageProducts(station: StationDto) {
    this.dialog.open(StationProductsModalComponent, { width: '640px', maxWidth: '95vw', data: station });
  }

  private openForm<T>(component: ComponentType<T>, data: StationModalData) {
    this.dialog
      .open<T, StationModalData, StationModalResult>(component, { width: '600px', maxWidth: '95vw', disableClose: true, data })
      .afterClosed()
      .subscribe((result) => this.handleResult(result));
  }

  private handleResult(result: StationModalResult | undefined) {
    const messages: Partial<Record<StationModalResult, string>> = {
      created: 'Estación creada. Ahora asígnale productos.',
      updated: 'Estación actualizada',
      deleted: 'Estación eliminada',
    };
    const message = result ? messages[result] : undefined;
    if (!message) return;
    this.toast.show(message, 'success');
    this.getAllService.load();
  }
}
