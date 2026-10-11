import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { IconComponent, SkeletonComponent } from 'src/ui';
import { getPrinterConnection, PrinterConnection, PrinterDto } from '../../data-access';

@Component({
  selector: 'app-printers-table',
  standalone: true,
  imports: [IconComponent, SkeletonComponent, CheckPermissionDirective],
  templateUrl: './printers-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintersTableComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  readonly printers = input.required<PrinterDto[]>();
  readonly loading = input(false);
  readonly locationNames = input<Record<number, string>>({});
  // Reloj de la página, para recalcular "hace X min" sin recargar la tabla.
  readonly now = input.required<number>();
  readonly testingIds = input<ReadonlySet<number>>(new Set());

  readonly test = output<PrinterDto>();
  readonly edit = output<PrinterDto>();
  readonly delete = output<PrinterDto>();

  readonly skeletonRows = [1, 2, 3];

  agentStatus(printer: PrinterDto): PrinterConnection {
    return getPrinterConnection(printer.lastSeenAt, this.now());
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  connection(printer: PrinterDto): string {
    return printer.type === 'usb' ? 'USB' : `${printer.ipAddress ?? '—'}:${printer.port ?? 9100}`;
  }
}
