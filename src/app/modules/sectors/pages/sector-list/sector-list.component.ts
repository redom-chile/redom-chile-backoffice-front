import { Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HeaderDashboardComponent, ButtonComponent, IconComponent, ToastService } from 'src/ui';
import { SectorsTableComponent, CreateSectorModalComponent } from './features';
import { GetAllSectorsService, CreateSectorService, UpdateSectorService, DeleteSectorService } from './data-access';
import { FiltersSectorTableComponent } from './ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-sector-list',
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SectorsTableComponent,
    FiltersSectorTableComponent,
    CheckPermissionDirective,
  ],
  templateUrl: './sector-list.component.html',
})
export class SectorListComponent implements OnDestroy {
  private readonly dialog = inject(MatDialog);

  protected readonly PERMISSIONS = PERMISSIONS;

  protected readonly $getAll = inject(GetAllSectorsService);
  protected readonly $createService = inject(CreateSectorService);
  protected readonly $updateService = inject(UpdateSectorService);
  protected readonly $deleteService = inject(DeleteSectorService);
  private readonly $toast = inject(ToastService);
  protected readonly selectedLocationId = signal<number | null>(null);

  protected readonly $sectors = this.$getAll.$sectors;
  protected readonly $isLoading = this.$getAll.$isLoading;
  protected readonly $hasError = this.$getAll.$hasError;

  constructor() {
    effect(() => {
      if (this.$createService.$success()) this.$getAll.retry();
      if (this.$updateService.$success()) this.$getAll.retry();
      if (this.$deleteService.$success()) this.$getAll.retry();
    });
  }

  createSector() {
    this.dialog.open(CreateSectorModalComponent, { width: '90%' });
  }

  retry() {
    this.$getAll.retry();
  }

  ngOnDestroy(): void {
    this.$createService.reset();
    this.$updateService.reset();
    this.$deleteService.reset();
  }

  onLocationIdChange(locationId: number) {
    this.selectedLocationId.set(locationId);

    this.$getAll.setParams({
      locationId,
    });
  }
}
