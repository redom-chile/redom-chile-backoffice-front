import { Component, EventEmitter, input, Output, signal, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ButtonComponent, IconComponent, ProgressBarComponent, SlotDirective, TableComponent } from 'src/ui';
import { SectorDto } from '../../data-access';
import { CreateSectorModalComponent } from '../create-sector-modal';
import { UpdateSectorModalComponent } from '../update-sector-modal';
import { DeleteSectorModalComponent } from '../delete-sector-modal';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-sectors-table',
  imports: [TableComponent, SlotDirective, ButtonComponent, IconComponent, ProgressBarComponent, CheckPermissionDirective],
  templateUrl: './sectors-table.component.html',
})
export class SectorsTableComponent {
  private readonly dialog = inject(MatDialog);

  protected readonly PERMISSIONS = PERMISSIONS;
  readonly $sectors = input.required<SectorDto[]>({ alias: 'sectors' });
  readonly isLoading = input(false, { alias: 'isLoading' });

  @Output() pageChange = new EventEmitter<number>();
  @Output() perPageChange = new EventEmitter<number>();
  @Output() searchNameChange = new EventEmitter<string>();
  @Output() retryData = new EventEmitter<void>();
  @Output() locationIdChange = new EventEmitter<number>();

  readonly headerData = ['Nombre', 'Estado', 'Acción'];
  readonly perPage = signal(10);

  onLocationIdChange(locationId: number) {
    this.locationIdChange.emit(locationId);
  }

  createSector() {
    this.dialog.open(CreateSectorModalComponent, { width: '90%' });
  }

  updateSector(item: SectorDto) {
    this.dialog.open(UpdateSectorModalComponent, { width: '90%', data: item });
  }

  deleteSector(item: SectorDto) {
    this.dialog.open(DeleteSectorModalComponent, { width: '90%', data: item });
  }

  onChangePage(page: number) {
    this.pageChange.emit(page);
  }

  onSearchNameChange(value: string) {
    this.searchNameChange.emit(value);
  }

  onPerPageChange(event: Event) {
    const v = Number((event.target as HTMLSelectElement).value);
    this.perPage.set(v);
    this.perPageChange.emit(v);
  }

  retry() {
    this.retryData.emit();
  }
}
