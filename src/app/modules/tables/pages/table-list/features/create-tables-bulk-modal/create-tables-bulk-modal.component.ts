import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { SectorDto } from 'src/app/modules/sectors/pages/sector-list/data-access';
import { ButtonComponent, IconComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import { CreateTablesBulkResultDto, CreateTablesBulkService, getTableErrorMessage } from '../../data-access';

export type CreateTablesBulkData = Readonly<{
  sectors: SectorDto[];
  // Pestaña de sector activa en la página
  sectorId: number | null;
  // Local elegido en la página
  locationId: number | null;
}>;

@Component({
  selector: 'app-create-tables-bulk-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, IconComponent, ModalCardComponent, SlotDirective],
  templateUrl: './create-tables-bulk-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateTablesBulkModalComponent implements OnDestroy {
  private readonly dialogRef = inject<MatDialogRef<CreateTablesBulkModalComponent, CreateTablesBulkResultDto>>(MatDialogRef);
  private readonly toast = inject(ToastService);
  private readonly service = inject(CreateTablesBulkService);
  private readonly locationsService = inject(GetAllBusinessLocationsService);

  readonly data = inject<CreateTablesBulkData>(MAT_DIALOG_DATA);
  readonly sectors = this.data.sectors;

  readonly form = new FormGroup({
    count: new FormControl<number | null>(null, [Validators.required, Validators.min(1), Validators.max(100), Validators.pattern(/^\d+$/)]),
    sectorId: new FormControl<number | null>(this.initialSectorId(), Validators.required),
    prefix: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    capacity: new FormControl<number | null>(null, [Validators.min(1), Validators.pattern(/^\d+$/)]),
    locationId: new FormControl<number | null>(this.data.locationId),
  });

  protected readonly $isLoading = this.service.$isLoading;
  protected readonly $locations = computed(() => this.locationsService.$locations() ?? []);
  readonly #value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly #status = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly $sector = computed(() => this.sectors.find((s) => s.id === this.#value().sectorId) ?? null);
  // Sin local en el sector, el backend exige elegir uno.
  protected readonly $needsLocation = computed(() => {
    const sector = this.$sector();
    return !!sector && sector.locationId === null;
  });
  protected readonly $prefixExample = computed(() => this.#value().prefix?.trim() || this.$sector()?.name || 'Mesa');
  protected readonly $canSubmit = computed(
    () => this.#status() === 'VALID' && (!this.$needsLocation() || !!this.#value().locationId) && !this.$isLoading(),
  );

  constructor() {
    effect(() => {
      const result = this.service.$result();
      if (!result) return;
      const names = result.names.length ? result.names : result.tables.map((t) => t.name);
      const total = names.length;
      const message =
        total === 1 ? `Creamos 1 mesa: ${names[0]}` : `Creamos ${total} mesas: ${names[0]} a ${names[total - 1]}`;
      this.toast.show(message, 'success');
      this.service.reset();
      this.dialogRef.close(result);
    });

    effect(() => {
      const error = this.service.$error();
      if (!error) return;
      // El interceptor de soporte ya avisa esos casos.
      if (!error.code?.startsWith('SUPPORT_ACCESS_')) this.toast.show(getTableErrorMessage(error), 'error');
    });
  }

  private initialSectorId(): number | null {
    const { sectorId } = this.data;
    if (sectorId !== null && this.sectors.some((s) => s.id === sectorId)) return sectorId;
    return this.sectors.length === 1 ? this.sectors[0].id : null;
  }

  protected showCountError(): boolean {
    const control = this.form.controls.count;
    return control.invalid && control.touched;
  }

  submit() {
    if (!this.$canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const { count, sectorId, prefix, capacity, locationId } = this.form.getRawValue();
    this.service.create({
      sectorId: sectorId!,
      count: Number(count),
      prefix: prefix.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      locationId: this.$needsLocation() ? (locationId ?? undefined) : undefined,
    });
  }

  close() {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.service.reset();
  }
}

export function openCreateTablesBulkModal(
  dialog: MatDialog,
  data: CreateTablesBulkData,
): Observable<CreateTablesBulkResultDto | undefined> {
  return dialog
    .open<CreateTablesBulkModalComponent, CreateTablesBulkData, CreateTablesBulkResultDto>(CreateTablesBulkModalComponent, {
      width: '480px',
      maxWidth: '95vw',
      autoFocus: '#bulk-count',
      data,
    })
    .afterClosed();
}
