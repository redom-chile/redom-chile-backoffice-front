import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable, startWith } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { SupplierDto, supplierLabel, SuppliersService, todayIsoDate } from 'src/app/modules/inventory/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, ModalCardComponent, SlotDirective, ToastService } from 'src/ui';
import {
  EXPENSE_DOCUMENT_LABELS,
  ExpenseCategoryDto,
  ExpenseDocumentType,
  ExpensesService,
  getFinanceErrorMessage,
  RecurringExpenseDto,
  RecurringFrequency,
  recurrenceLabel,
  SaveRecurringExpenseDto,
  suggestedVat,
  WEEKDAY_LABELS,
} from '../../data-access';

export type RecurringModalData = Readonly<{
  // Sin recurrente: crear.
  recurring?: RecurringExpenseDto;
  // Todas las categorías (las inactivas solo se muestran si son la actual).
  categories: readonly ExpenseCategoryDto[];
  locations: readonly { id: number; name: string }[];
  defaultLocationId?: number | null;
}>;

// created: cuántos gastos pendientes se generaron por fechas pasadas.
export type RecurringModalResult = Readonly<{ kind: 'created'; id: number; generated: number }> | Readonly<{ kind: 'updated' }>;

const DOCUMENT_TYPES: ExpenseDocumentType[] = ['none', 'receipt', 'invoice'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

/** Crear o editar un gasto recurrente (arriendo, sueldos, servicios). Los cambios aplican a lo que aún no se genera. */
@Component({
  selector: 'app-recurring-modal',
  imports: [ReactiveFormsModule, ButtonComponent, ModalCardComponent, SlotDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recurring-modal.component.html',
})
export class RecurringModalComponent {
  readonly dialogRef = inject<MatDialogRef<RecurringModalComponent, RecurringModalResult>>(MatDialogRef);
  readonly data = inject<RecurringModalData>(MAT_DIALOG_DATA);
  readonly #fb = inject(FormBuilder);
  readonly #expenses = inject(ExpensesService);
  readonly #suppliersService = inject(SuppliersService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);

  readonly recurring = this.data.recurring ?? null;
  readonly documentTypes = DOCUMENT_TYPES;
  readonly documentLabels = EXPENSE_DOCUMENT_LABELS;
  readonly monthDays = MONTH_DAYS;
  readonly weekdays = WEEKDAY_LABELS.map((label, index) => ({ value: index + 1, label: label[0].toUpperCase() + label.slice(1) }));
  readonly supplierLabel = supplierLabel;
  readonly formatCurrency = formatCurrency;
  readonly $step = computed(() => 1 / 10 ** this.#settings.$currencyPrecision());

  readonly categories = this.data.categories.filter((category) => category.isActive || category.id === this.recurring?.categoryId);

  readonly form = this.#fb.group({
    locationId: this.#fb.control<number | null>(
      this.recurring?.locationId ?? this.data.defaultLocationId ?? this.data.locations[0]?.id ?? null,
      Validators.required,
    ),
    categoryId: this.#fb.control<number | null>(this.recurring?.categoryId ?? null, Validators.required),
    supplierId: this.#fb.control<number | null>(this.recurring?.supplierId ?? null),
    description: this.#fb.nonNullable.control(this.recurring?.description ?? '', [Validators.required, Validators.maxLength(255)]),
    amount: this.#fb.control<number | null>(this.recurring?.amount ?? null, [Validators.required, Validators.min(0.0001)]),
    documentType: this.#fb.nonNullable.control<ExpenseDocumentType>(this.recurring?.documentType ?? 'none'),
    vatAmount: this.#fb.control<number | null>(this.recurring?.vatAmount ?? null, Validators.min(0)),
    frequency: this.#fb.nonNullable.control<RecurringFrequency>(this.recurring?.frequency ?? 'monthly'),
    dayOfPeriod: this.#fb.nonNullable.control<number>(this.recurring?.dayOfPeriod ?? 1, Validators.required),
    startDate: this.#fb.nonNullable.control(this.recurring?.startDate?.slice(0, 10) ?? todayIsoDate(), Validators.required),
    endDate: this.#fb.nonNullable.control(this.recurring?.endDate?.slice(0, 10) ?? ''),
    dueDays: this.#fb.control<number | null>(this.recurring?.dueDays ?? 0, [Validators.min(0), Validators.max(365)]),
  });

  readonly $suppliers = signal<SupplierDto[]>([]);
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  // Mientras no se edite a mano, el IVA sigue al monto.
  #vatEdited =
    !!this.recurring &&
    this.recurring.documentType === 'invoice' &&
    this.recurring.vatAmount !==
      suggestedVat(this.recurring.amount, this.#settings.$vatRate(), this.#settings.$currencyPrecision());

  readonly $value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  readonly $isInvoice = computed(() => this.$value().documentType === 'invoice');
  readonly $isWeekly = computed(() => this.$value().frequency === 'weekly');
  readonly $net = computed(() => {
    const { amount, vatAmount } = this.$value();
    return Math.max(0, (Number(amount) || 0) - (Number(vatAmount) || 0));
  });
  readonly $preview = computed(() => {
    const { frequency, dayOfPeriod } = this.$value();
    return frequency && dayOfPeriod ? recurrenceLabel(frequency, Number(dayOfPeriod)) : '';
  });
  // Inicio en el pasado: al crear se generan los gastos que ya ocurrieron.
  readonly $startsInPast = computed(() => !this.recurring && (this.$value().startDate ?? '') < todayIsoDate());

  constructor() {
    this.#suppliersService
      .getAll()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({ next: (response) => this.$suppliers.set(response.data), error: () => this.$suppliers.set([]) });

    this.form.controls.amount.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.#syncVat());
    this.form.controls.documentType.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.#syncVat());
    this.form.controls.frequency.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((frequency) => {
      if (frequency === 'weekly' && this.form.controls.dayOfPeriod.value > 7) this.form.controls.dayOfPeriod.setValue(1);
    });
  }

  handleVatInput() {
    this.#vatEdited = true;
  }

  isInvalid(name: keyof RecurringModalComponent['form']['controls']): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.$submitted());
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const value = this.form.getRawValue();
    const amount = Number(value.amount) || 0;
    const vatAmount = value.documentType === 'invoice' ? Number(value.vatAmount) || 0 : 0;
    if (this.form.invalid || amount <= 0) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    if (vatAmount > amount) {
      this.#toast.show('El IVA no puede ser mayor que el monto', 'warning');
      return;
    }
    if (value.endDate && value.endDate < value.startDate) {
      this.#toast.show('La fecha de término no puede ser anterior al inicio', 'warning');
      return;
    }

    const dto: SaveRecurringExpenseDto = {
      locationId: value.locationId!,
      categoryId: value.categoryId!,
      supplierId: value.supplierId ?? null,
      description: value.description.trim(),
      amount,
      vatAmount,
      documentType: value.documentType,
      frequency: value.frequency,
      dayOfPeriod: Number(value.dayOfPeriod),
      startDate: value.startDate,
      endDate: value.endDate || null,
      dueDays: Number(value.dueDays) || 0,
    };

    this.$isSaving.set(true);
    const recurring = this.recurring;
    if (recurring) {
      // El backend exige el registro completo (incluido isActive).
      this.#expenses
        .updateRecurring(recurring.id, { ...dto, isActive: recurring.isActive })
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: () => {
            this.#toast.show('Gasto recurrente actualizado', 'success');
            this.dialogRef.close({ kind: 'updated' });
          },
          error: (error: unknown) => this.#fail(error),
        });
      return;
    }
    this.#expenses
      .createRecurring(dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: ({ id, generated }) => this.dialogRef.close({ kind: 'created', id, generated }),
        error: (error: unknown) => this.#fail(error),
      });
  }

  #fail(error: unknown) {
    this.$isSaving.set(false);
    this.#toast.show(getFinanceErrorMessage(error, 'No se pudo guardar el gasto recurrente'), 'error');
  }

  #syncVat() {
    const { documentType, amount } = this.form.getRawValue();
    if (documentType !== 'invoice' || this.#vatEdited) return;
    this.form.controls.vatAmount.setValue(
      suggestedVat(Number(amount) || 0, this.#settings.$vatRate(), this.#settings.$currencyPrecision()),
      { emitEvent: true },
    );
  }
}

export function openRecurringModal(dialog: MatDialog, data: RecurringModalData): Observable<RecurringModalResult | undefined> {
  return dialog
    .open<RecurringModalComponent, RecurringModalData, RecurringModalResult>(RecurringModalComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      data,
    })
    .afterClosed();
}
