import { Component, inject, input, output } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { NgClass } from '@angular/common';

import { ButtonComponent, ProgressBarComponent, SlotDirective, TableComponent } from 'src/ui';

import { TableDto, TableStatus } from '../../data-access';

import { CreateTableModalComponent } from '../create-table-modal';

import { UpdateTableModalComponent } from '../update-table-modal';

import { DeleteTableModalComponent } from '../delete-table-modal';

import { TableQrModalComponent, TableQrModalResult } from '../table-qr-modal';

import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';

@Component({
  selector: 'app-tables-table',

  imports: [NgClass, TableComponent, SlotDirective, ButtonComponent, ProgressBarComponent, CheckPermissionDirective],

  templateUrl: './tables-table.component.html',
})
export class TablesTableComponent {
  private readonly dialog = inject(MatDialog);

  protected readonly PERMISSIONS = PERMISSIONS;

  readonly $tables = input.required<TableDto[]>({
    alias: 'tables',
  });

  readonly isLoading = input(false, {
    alias: 'isLoading',
  });

  readonly retryData = output<void>();

  readonly headerData = ['Nombre', 'Capacidad', 'Ubicación', 'Estado', 'Acción'];

  createTable() {
    this.dialog.open(CreateTableModalComponent, {
      width: '90%',
    });
  }

  updateTable(item: TableDto) {
    this.dialog.open(UpdateTableModalComponent, {
      width: '90%',
      data: item,
    });
  }

  showQr(item: TableDto) {
    this.dialog
      .open<TableQrModalComponent, TableDto, TableQrModalResult>(TableQrModalComponent, {
        width: '560px',
        maxWidth: '95vw',
        data: item,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'regenerated') this.retryData.emit();
      });
  }

  deleteTable(item: TableDto) {
    this.dialog.open(DeleteTableModalComponent, {
      width: '90%',
      data: item,
    });
  }

  retry() {
    this.retryData.emit();
  }

  statusClasses(status: TableStatus): string {
    const map: Record<TableStatus, string> = {
      available: 'bg-green-500/20 text-green-600',
      occupied: 'bg-red-500/20 text-red-600',
      reserved: 'bg-blue-500/20 text-blue-600',
      blocked: 'bg-muted text-muted-foreground',
    };

    return map[status];
  }

  statusLabel(status: TableStatus): string {
    const map: Record<TableStatus, string> = {
      available: 'Disponible',
      occupied: 'Ocupada',
      reserved: 'Reservada',
      blocked: 'Bloqueada',
    };

    return map[status];
  }
}
