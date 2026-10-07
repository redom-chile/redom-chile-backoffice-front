import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { startWith } from 'rxjs';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  formatMoney,
  formatQuantity,
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  PurchaseOrdersService,
  ReceivePurchaseOrderDto,
  todayIsoDate,
  UnitDto,
  unitMultiplier,
  UnitsService,
} from '../../../../data-access';
import { getPurchaseOrderErrorMessage } from '../../data-access';

export type ReceiveOrderModalData = Readonly<{ order: PurchaseOrderDto }>;
/** Orden actualizada tras recibir; undefined = cancelado. */
export type ReceiveOrderModalResult = PurchaseOrderDto | undefined;

type ReceiveRowForm = FormGroup<{
  include: FormControl<boolean>;
  quantity: FormControl<number | null>;
  unitCost: FormControl<number | null>;
  lotNumber: FormControl<string>;
  expiryDate: FormControl<string>;
}>;

type ReceiveRow = Readonly<{
  line: PurchaseOrderLineDto;
  unit: UnitDto | null;
  // Pendiente expresado en la unidad de la línea.
  pending: number;
  form: ReceiveRowForm;
}>;

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function decimalsOf(value: number): number {
  const [, decimals = ''] = String(value).split('.');
  return decimals.length;
}

function hasNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

/**
 * Recepción de una orden de compra: una fila por línea con pendiente (o todas, para recibir de más).
 * La cantidad va en la unidad de la línea y se precarga con lo pendiente. Crea una compra y devuelve la orden.
 */
@Component({
  selector: 'app-receive-order-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './receive-order-modal.component.html',
})
export class ReceiveOrderModalComponent {
  readonly #dialogRef = inject<MatDialogRef<ReceiveOrderModalComponent, ReceiveOrderModalResult>>(MatDialogRef);
  readonly #data = inject<ReceiveOrderModalData>(MAT_DIALOG_DATA);
  readonly #orders = inject(PurchaseOrdersService);
  readonly #units = inject(UnitsService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly order = this.#data.order;
  protected readonly today = todayIsoDate();

  readonly header = new FormGroup({
    referenceNo: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
    documentDate: new FormControl(todayIsoDate(), { nonNullable: true, validators: Validators.required }),
    notes: new FormControl('', { nonNullable: true, validators: Validators.maxLength(1000) }),
  });

  readonly rows: ReceiveRow[] = this.order.lines.map((line) => this.#createRow(line));
  readonly #rowsArray = new FormArray(this.rows.map((row) => row.form));

  readonly hasPendingLines = this.rows.some((row) => row.line.pendingBaseQuantity > 0);
  // Sin pendientes (todo recibido) se muestran todas para poder recibir de más.
  readonly $showAll = signal(!this.hasPendingLines);
  readonly $submitted = signal(false);
  readonly $isSaving = signal(false);

  readonly $visibleRows = computed(() =>
    this.$showAll() ? this.rows : this.rows.filter((row) => row.line.pendingBaseQuantity > 0),
  );

  // Se recalcula con cada cambio de las filas (total estimado y cantidad incluida).
  readonly #rowsValue = toSignal(this.#rowsArray.valueChanges.pipe(startWith(null)));

  readonly $included = computed(() => {
    this.#rowsValue();
    return this.$visibleRows().filter((row) => row.form.controls.include.value);
  });

  readonly $total = computed(() =>
    this.$included().reduce((sum, row) => {
      const { quantity, unitCost } = row.form.getRawValue();
      const cost = hasNumber(unitCost) ? unitCost : row.line.unitCost;
      return sum + (hasNumber(quantity) ? Number(quantity) * Number(cost) : 0);
    }, 0),
  );

  toggleShowAll() {
    this.$showAll.update((value) => !value);
  }

  unitName(row: ReceiveRow): string {
    return row.line.unitName ?? row.unit?.shortName ?? '';
  }

  showRowErrors(row: ReceiveRow): boolean {
    return row.form.invalid && (this.$submitted() || row.form.touched);
  }

  quantityError(row: ReceiveRow): string | null {
    const errors = row.form.errors ?? {};
    if (errors['quantityRequired']) return 'Ingresa la cantidad.';
    if (errors['quantityPositive']) return 'Debe ser mayor a 0.';
    if (errors['quantityPrecision']) return 'Máximo 4 decimales.';
    if (errors['quantityDecimals']) return `"${errors['quantityDecimals']}" no permite decimales.`;
    return null;
  }

  costError(row: ReceiveRow): string | null {
    return row.form.errors?.['costNegative'] ? 'No puede ser negativo.' : null;
  }

  isOver(row: ReceiveRow): boolean {
    const quantity = row.form.controls.quantity.value;
    return row.form.controls.include.value && hasNumber(quantity) && Number(quantity) > row.pending + 0.00005;
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const included = this.$included();
    if (!included.length) {
      this.#toast.show('Marca al menos una línea para recibir.', 'warning');
      return;
    }
    if (this.header.invalid || included.some((row) => row.form.invalid)) {
      this.header.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados.', 'warning');
      return;
    }

    const header = this.header.getRawValue();
    const referenceNo = header.referenceNo.trim();
    const notes = header.notes.trim();
    const dto: ReceivePurchaseOrderDto = {
      ...(referenceNo ? { referenceNo } : {}),
      documentDate: header.documentDate,
      ...(notes ? { notes } : {}),
      lines: included.map((row) => {
        const { quantity, unitCost, lotNumber, expiryDate } = row.form.getRawValue();
        const lot = lotNumber.trim();
        return {
          lineId: row.line.id,
          quantity: Number(quantity),
          ...(hasNumber(unitCost) ? { unitCost: Number(unitCost) } : {}),
          ...(lot ? { lotNumber: lot } : {}),
          ...(expiryDate ? { expiryDate } : {}),
        };
      }),
    };

    this.$isSaving.set(true);
    this.#orders
      .receive(this.order.id, dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (order) => this.#dialogRef.close(order),
        // El modal queda abierto con lo ingresado para reintentar.
        error: (error) => {
          this.$isSaving.set(false);
          this.#toast.show(getPurchaseOrderErrorMessage(error, 'No se pudo registrar la recepción. Intenta nuevamente.'), 'error');
        },
      });
  }

  handleCancel() {
    this.#dialogRef.close(undefined);
  }

  // ---------- Privados ----------

  #createRow(line: PurchaseOrderLineDto): ReceiveRow {
    const unit = line.unitId ? (this.#units.$units()?.find((candidate) => candidate.id === line.unitId) ?? null) : null;
    // La unidad base tiene multiplicador 1; una subunidad convierte desde la base.
    const pending = round4(line.pendingBaseQuantity / unitMultiplier(unit));
    const hasPending = line.pendingBaseQuantity > 0;
    const form: ReceiveRowForm = new FormGroup(
      {
        include: new FormControl(hasPending, { nonNullable: true }),
        quantity: new FormControl<number | null>(hasPending ? pending : null),
        unitCost: new FormControl<number | null>(line.unitCost),
        lotNumber: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        expiryDate: new FormControl('', { nonNullable: true }),
      },
      { validators: (group) => this.#validateRow(group as ReceiveRowForm, unit) },
    );
    return { line, unit, pending, form };
  }

  #validateRow(form: ReceiveRowForm, unit: UnitDto | null): ValidationErrors | null {
    const { include, quantity, unitCost } = form.getRawValue();
    if (!include) return null;
    const errors: ValidationErrors = {};
    if (!hasNumber(quantity)) errors['quantityRequired'] = true;
    else if (quantity <= 0) errors['quantityPositive'] = true;
    else if (decimalsOf(quantity) > 4) errors['quantityPrecision'] = true;
    else if (unit && !unit.allowDecimal && !Number.isInteger(quantity)) errors['quantityDecimals'] = unit.shortName;
    if (hasNumber(unitCost) && unitCost < 0) errors['costNegative'] = true;
    return Object.keys(errors).length ? errors : null;
  }
}
