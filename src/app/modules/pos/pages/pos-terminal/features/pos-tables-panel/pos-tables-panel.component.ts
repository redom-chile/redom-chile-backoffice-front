import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent, ProgressBarComponent } from 'src/ui';
import { TableDto, TableStatus } from 'src/app/modules/tables/pages/table-list/data-access';
import { SectorDto } from 'src/app/modules/sectors/pages/sector-list/data-access';

const STATUS_CLASSES: Record<TableStatus, string> = {
  available: 'border-green-500/60 text-green-700 dark:text-green-400',
  occupied: 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-400',
  reserved: 'border-blue-500/60 text-blue-700 dark:text-blue-400',
  blocked: 'border-[var(--border)] text-muted-foreground opacity-50',
};

@Component({
  selector: 'app-pos-tables-panel',
  standalone: true,
  imports: [IconComponent, ProgressBarComponent],
  templateUrl: './pos-tables-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosTablesPanelComponent {
  readonly tables = input.required<TableDto[]>();
  readonly sectors = input<SectorDto[]>([]);
  readonly loading = input(false);
  // null = mostrador (sin mesa).
  readonly selectedTableId = input<number | null>(null);

  readonly selectTable = output<TableDto>();
  readonly selectCounter = output<void>();

  readonly $sectorId = signal<number | null>(null);
  readonly $visibleTables = computed(() => {
    const sectorId = this.$sectorId();
    return sectorId === null ? this.tables() : this.tables().filter((table) => table.sectorId === sectorId);
  });
  readonly $occupiedCount = computed(() => this.tables().filter((table) => table.status === 'occupied').length);

  statusClasses(status: TableStatus): string {
    return STATUS_CLASSES[status];
  }
}
