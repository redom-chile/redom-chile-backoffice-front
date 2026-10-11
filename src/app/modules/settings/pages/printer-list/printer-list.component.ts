import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ComponentType } from '@angular/cdk/portal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { interval } from 'rxjs';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { PERMISSIONS } from 'src/app/core/permissions';
import { readApiError } from 'src/app/core/utils';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import {
  GetAllPrintersService,
  getPrinterConnection,
  getPrinterErrorMessage,
  PrinterDto,
  PrintTestService,
} from './data-access';
import {
  CreatePrinterModalComponent,
  DeletePrinterModalComponent,
  PrinterModalResult,
  PrintersTableComponent,
  UpdatePrinterModalComponent,
} from './features';

// Se recarga la lista para mantener al día el estado de conexión (lastSeenAt).
const REFRESH_MS = 30_000;

@Component({
  selector: 'app-printer-list',
  standalone: true,
  imports: [HeaderDashboardComponent, ButtonComponent, IconComponent, EmptyStateComponent, PrintersTableComponent, CheckPermissionDirective],
  templateUrl: './printer-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrinterListComponent implements OnInit {
  protected readonly PERMISSIONS = PERMISSIONS;
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly getAllService = inject(GetAllPrintersService);
  private readonly printTestService = inject(PrintTestService);
  private readonly locationsService = inject(GetAllBusinessLocationsService);

  readonly $now = signal(Date.now());
  readonly $testingIds = signal<ReadonlySet<number>>(new Set());

  readonly $printers = computed(() => this.getAllService.$printers() ?? []);
  readonly $isLoading = computed(() => this.getAllService.$isLoading() ?? false);
  readonly $errorMessage = computed(() => {
    const status = this.getAllService.$error();
    return status ? getPrinterErrorMessage(status) : null;
  });
  readonly $isEmpty = computed(
    () => !this.$isLoading() && !this.$errorMessage() && this.getAllService.$printers() !== undefined && !this.$printers().length,
  );
  readonly $locationNames = computed(() =>
    Object.fromEntries((this.locationsService.$locations() ?? []).map((location) => [location.id, location.name])),
  );

  ngOnInit(): void {
    this.getAllService.load();
    interval(REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.$now.set(Date.now());
        this.getAllService.load();
      });
  }

  handleTest(printer: PrinterDto) {
    this.setTesting(printer.id, true);
    this.printTestService.printTest(printer.id).subscribe({
      next: () => {
        this.setTesting(printer.id, false);
        // El ticket queda en cola: solo sale si hay una estación de impresión atendiendo esta impresora.
        if (getPrinterConnection(printer.lastSeenAt, Date.now()).state === 'online') {
          this.toast.show(`Prueba enviada a ${printer.name}`, 'success');
        } else {
          this.toast.show(`Prueba en cola: saldrá cuando una estación de impresión atienda ${printer.name}`, 'warning');
        }
      },
      error: (error: unknown) => {
        this.setTesting(printer.id, false);
        this.toast.show(getPrinterErrorMessage(readApiError(error).status), 'error');
      },
    });
  }

  handleRetry() {
    this.getAllService.load();
  }

  handleCreate() {
    this.open(CreatePrinterModalComponent, undefined, '560px');
  }

  handleUpdate(printer: PrinterDto) {
    this.open(UpdatePrinterModalComponent, printer, '560px');
  }

  handleDelete(printer: PrinterDto) {
    this.open(DeletePrinterModalComponent, printer, '480px');
  }

  private setTesting(id: number, testing: boolean) {
    this.$testingIds.update((ids) => {
      const next = new Set(ids);
      if (testing) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private open<T>(component: ComponentType<T>, data: PrinterDto | undefined, width: string) {
    this.dialog
      .open<T, PrinterDto | undefined, PrinterModalResult>(component, { width, maxWidth: '95vw', disableClose: true, data })
      .afterClosed()
      .subscribe((result) => {
        const messages: Partial<Record<PrinterModalResult, string>> = {
          created: 'Impresora creada',
          updated: 'Impresora actualizada',
          deleted: 'Impresora eliminada',
        };
        const message = result ? messages[result] : undefined;
        if (!message) return;
        this.toast.show(message, 'success');
        this.getAllService.load();
      });
  }
}
