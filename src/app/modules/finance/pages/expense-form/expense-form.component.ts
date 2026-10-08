import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { readApiError } from 'src/app/core/utils/api-error';
import { PAYMENT_METHOD_LABELS } from 'src/app/modules/cash/data-access';
import { CashRetryService } from 'src/app/modules/cash/features/cash-retry';
import { InventoryLocationStore, SupplierDto, supplierLabel, SuppliersService, todayIsoDate } from 'src/app/modules/inventory/data-access';
import {
  CreateSupplierModalComponent,
  CreateSupplierModalResult,
} from 'src/app/modules/inventory/features/create-supplier-modal';
import { resultError, resultValue, toRemoteResult } from 'src/app/modules/inventory/shared/data-access';
import { formatCurrency } from 'src/app/modules/orders/pages/order-list/ui';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  CreateExpenseDto,
  EXPENSE_DOCUMENT_LABELS,
  ExpenseCategoryDto,
  ExpenseDocumentType,
  ExpenseDto,
  ExpensesService,
  getFinanceErrorMessage,
  PaymentMethod,
  suggestedVat,
  UpdateExpenseDto,
} from '../../data-access';
import { openCategoryModal } from '../../features/category-modal';
import { ExpenseDocumentFieldComponent, ExpenseDocumentValue } from '../../features/expense-document-field';

const DOCUMENT_TYPES: ExpenseDocumentType[] = ['none', 'receipt', 'invoice'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer', 'other'];

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Nuevo gasto o edición (ruta con :id). Al crear se puede marcar "Pagado ahora". */
@Component({
  selector: 'app-expense-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    ExpenseDocumentFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-form.component.html',
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class ExpenseFormComponent {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #expenses = inject(ExpensesService);
  readonly #suppliersService = inject(SuppliersService);
  readonly #cashRetry = inject(CashRetryService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  readonly expenseId = positiveId(this.#route.snapshot.paramMap.get('id'));
  readonly isEdit = this.expenseId !== null;

  readonly documentTypes = DOCUMENT_TYPES;
  readonly documentLabels = EXPENSE_DOCUMENT_LABELS;
  readonly paymentMethods = PAYMENT_METHODS;
  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly supplierLabel = supplierLabel;
  readonly formatCurrency = formatCurrency;

  readonly form = this.#fb.group({
    locationId: this.#fb.control<number | null>(null, Validators.required),
    categoryId: this.#fb.control<number | null>(null, Validators.required),
    supplierId: this.#fb.control<number | null>(null),
    description: this.#fb.nonNullable.control('', [Validators.required, Validators.maxLength(255)]),
    amount: this.#fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
    documentType: this.#fb.nonNullable.control<ExpenseDocumentType>('none'),
    vatAmount: this.#fb.control<number | null>(null, Validators.min(0)),
    documentNo: this.#fb.nonNullable.control('', Validators.maxLength(100)),
    expenseDate: this.#fb.nonNullable.control(todayIsoDate(), Validators.required),
    dueDate: this.#fb.nonNullable.control(''),
    notes: this.#fb.nonNullable.control('', Validators.maxLength(1000)),
    payNow: this.#fb.nonNullable.control(false),
    method: this.#fb.nonNullable.control<PaymentMethod>('transfer'),
    reference: this.#fb.nonNullable.control('', Validators.maxLength(100)),
  });

  readonly $value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  // ---------- Datos ----------
  readonly detail = rxResource({
    params: () => this.expenseId ?? undefined,
    stream: ({ params }) => this.#expenses.get(params).pipe(toRemoteResult()),
  });
  readonly $expense = computed<ExpenseDto | null>(() => resultValue(this.detail.value()));
  readonly $detailError = computed(() => resultError(this.detail.value()));

  // Todas, para mostrar la actual aunque esté inactiva.
  readonly #categoriesResource = rxResource({ stream: () => this.#expenses.getCategories(true).pipe(toRemoteResult()) });
  readonly #extraCategories = signal<ExpenseCategoryDto[]>([]);
  readonly $categories = computed(() => {
    const all = [...(resultValue(this.#categoriesResource.value()) ?? []), ...this.#extraCategories()];
    const currentId = this.$expense()?.categoryId;
    return all.filter((category) => category.isActive || category.id === currentId);
  });
  readonly $categoriesFailed = computed(() => !!resultError(this.#categoriesResource.value()));

  readonly $suppliers = signal<SupplierDto[]>([]);
  readonly $suppliersFailed = signal(false);

  // ---------- Estado ----------
  readonly $document = signal<ExpenseDocumentValue>({ fileId: null, url: null });
  readonly #documentChanged = signal(false);
  readonly $uploading = signal(false);
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly #saved = signal(false);
  readonly #prefilled = signal(!this.isEdit);
  // Mientras no se edite a mano, el IVA sigue al monto.
  #vatEdited = false;

  readonly $isLoading = computed(
    () =>
      this.#categoriesResource.isLoading() || (this.isEdit && this.detail.isLoading()) || (!this.#prefilled() && !this.$detailError()),
  );
  readonly $isCancelled = computed(() => this.$expense()?.status === 'cancelled');
  readonly $hasPayments = computed(() => (this.$expense()?.paidAmount ?? 0) > 0);
  readonly $isInvoice = computed(() => this.$value().documentType === 'invoice');
  readonly $net = computed(() => {
    const { amount, vatAmount } = this.$value();
    return Math.max(0, (Number(amount) || 0) - (this.$isInvoice() ? Number(vatAmount) || 0 : 0));
  });
  readonly $step = computed(() => 1 / 10 ** this.#settings.$currencyPrecision());
  readonly $cashFromRegister = computed(
    () => this.#settings.$cashActive() && this.$value().payNow && this.$value().method === 'cash',
  );
  readonly $backLink = computed(() => (this.expenseId ? ['/finance/expenses', this.expenseId] : ['/finance/expenses']));

  constructor() {
    this.#loadSuppliers();

    // Nuevo: el local elegido en la app.
    effect(() => {
      const locationId = this.locationStore.$locationId();
      if (this.isEdit || !locationId) return;
      untracked(() => {
        if (this.form.controls.locationId.value === null) this.form.controls.locationId.setValue(locationId);
      });
    });

    // Edición: se llena una sola vez al llegar el detalle.
    effect(() => {
      const expense = this.$expense();
      if (!expense) return;
      untracked(() => this.#prefill(expense));
    });

    this.form.controls.amount.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.#syncVat());
    this.form.controls.documentType.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => this.#syncVat());
  }

  hasUnsavedChanges(): boolean {
    if (this.#saved() || !this.#prefilled() || this.$isCancelled()) return false;
    return this.form.dirty || this.#documentChanged();
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  handleVatInput() {
    this.#vatEdited = true;
  }

  handleDocumentChange(value: ExpenseDocumentValue) {
    this.$document.set(value);
    this.#documentChanged.set(true);
  }

  handleNewCategory() {
    openCategoryModal(this.#dialog).subscribe((category) => {
      if (!category) return;
      this.#extraCategories.update((list) => [...list, category]);
      this.form.controls.categoryId.setValue(category.id);
      this.form.controls.categoryId.markAsDirty();
    });
  }

  handleNewSupplier() {
    this.#dialog
      .open<CreateSupplierModalComponent, void, CreateSupplierModalResult>(CreateSupplierModalComponent, {
        width: '560px',
        maxWidth: '95vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((supplier) => {
        if (!supplier) return;
        this.$suppliers.update((suppliers) => [...suppliers, supplier]);
        this.form.controls.supplierId.setValue(supplier.id);
        this.form.controls.supplierId.markAsDirty();
        this.#toast.show('Proveedor creado', 'success');
      });
  }

  retryLoad() {
    if (this.$categoriesFailed()) this.#categoriesResource.reload();
    if (this.$detailError()) this.detail.reload();
  }

  #loadSuppliers() {
    this.$suppliersFailed.set(false);
    this.#suppliersService
      .getAll()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (response) => this.$suppliers.set(response.data),
        // El proveedor es opcional: se puede guardar igual.
        error: () => this.$suppliersFailed.set(true),
      });
  }

  reloadSuppliers() {
    this.#loadSuppliers();
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    if (this.$uploading()) {
      this.#toast.show('Espera a que termine de subir el documento', 'warning');
      return;
    }
    this.$submitted.set(true);
    const value = this.form.getRawValue();
    const amount = Number(value.amount) || 0;
    const vatAmount = value.documentType === 'invoice' ? Number(value.vatAmount) || 0 : 0;
    const factor = 10 ** this.#settings.$currencyPrecision();

    if (this.form.invalid || amount <= 0) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados', 'warning');
      return;
    }
    if (Math.round(amount * factor) !== amount * factor || Math.round(vatAmount * factor) !== vatAmount * factor) {
      this.#toast.show(factor === 1 ? 'Ingresa montos sin decimales' : 'Revisa los decimales del monto', 'warning');
      return;
    }
    if (vatAmount > amount) {
      this.#toast.show('El IVA no puede ser mayor que el monto', 'warning');
      return;
    }
    if (value.dueDate && value.dueDate < value.expenseDate) {
      this.#toast.show('El vencimiento no puede ser anterior a la fecha del gasto', 'warning');
      return;
    }
    const expense = this.$expense();
    if (expense && amount < expense.paidAmount) {
      this.#toast.show(`El monto no puede ser menor que lo ya pagado (${formatCurrency(expense.paidAmount)})`, 'warning');
      return;
    }

    const documentNo = value.documentNo.trim();
    const notes = value.notes.trim();
    const base = {
      locationId: value.locationId!,
      categoryId: value.categoryId!,
      description: value.description.trim(),
      amount,
      vatAmount,
      documentType: value.documentType,
      expenseDate: value.expenseDate,
      ...(value.dueDate ? { dueDate: value.dueDate } : {}),
    };

    if (expense) {
      // El backend exige local, categoría, descripción, monto y fecha: se envía todo.
      const dto: UpdateExpenseDto = {
        ...base,
        supplierId: value.supplierId ?? null,
        documentNo: documentNo || null,
        notes: notes || null,
        ...(this.#documentChanged() ? { documentFileId: this.$document().fileId } : {}),
      };
      this.$isSaving.set(true);
      this.#expenses
        .update(expense.id, dto)
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe({
          next: () => this.#done(expense.id, 'Gasto actualizado'),
          error: (error: unknown) => this.#fail(error),
        });
      return;
    }

    const method = value.method;
    const reference = value.reference.trim();
    const dto: CreateExpenseDto = {
      ...base,
      ...(value.supplierId ? { supplierId: value.supplierId } : {}),
      ...(documentNo ? { documentNo } : {}),
      ...(notes ? { notes } : {}),
      ...(this.$document().fileId ? { documentFileId: this.$document().fileId } : {}),
      ...(value.payNow
        ? {
            payment: {
              method,
              ...(reference ? { reference } : {}),
              ...(method === 'cash' ? { cashRegisterId: this.#cashRetry.deviceRegister(value.locationId) } : {}),
            },
          }
        : {}),
    };
    this.$isSaving.set(true);
    this.#create(dto);
  }

  #create(dto: CreateExpenseDto) {
    this.#expenses
      .create(dto)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (saved) =>
          this.#done(saved.id, dto.payment ? `Gasto registrado y pagado por ${formatCurrency(dto.amount)}` : 'Gasto registrado'),
        error: (error: unknown) => {
          if (dto.payment?.method !== 'cash') {
            this.#fail(error);
            return;
          }
          // Caja cerrada o varias cajas abiertas: se resuelve y se reintenta con la caja elegida.
          this.#cashRetry
            .resolve(readApiError(error), {
              locationId: dto.locationId,
              cashRegisterId: dto.payment.cashRegisterId ?? null,
              purpose: 'Para pagar este gasto en efectivo, abre la caja del local.',
            })
            .pipe(takeUntilDestroyed(this.#destroyRef))
            .subscribe((registerId) => {
              if (registerId === undefined) {
                this.#fail(error);
              } else if (registerId === null) {
                this.$isSaving.set(false);
              } else {
                this.#create({ ...dto, payment: { ...dto.payment!, cashRegisterId: registerId } });
              }
            });
        },
      });
  }

  #done(id: number, message: string) {
    this.#saved.set(true);
    this.#toast.show(message, 'success');
    this.#router.navigate(['/finance/expenses', id], { replaceUrl: this.isEdit });
  }

  // Si falla, el formulario queda intacto.
  #fail(error: unknown) {
    this.$isSaving.set(false);
    this.#toast.show(getFinanceErrorMessage(error, 'No se pudo guardar el gasto'), 'error');
  }

  #prefill(expense: ExpenseDto) {
    if (this.#prefilled()) return;
    // Antes del reset, para que el IVA guardado no se reemplace por el sugerido.
    this.#vatEdited =
      expense.documentType === 'invoice' &&
      expense.vatAmount !== suggestedVat(expense.amount, this.#settings.$vatRate(), this.#settings.$currencyPrecision());
    this.form.reset({
      locationId: expense.locationId,
      categoryId: expense.categoryId,
      supplierId: expense.supplierId,
      description: expense.description,
      amount: expense.amount,
      documentType: expense.documentType,
      vatAmount: expense.vatAmount,
      documentNo: expense.documentNo ?? '',
      expenseDate: expense.expenseDate.slice(0, 10),
      dueDate: expense.dueDate?.slice(0, 10) ?? '',
      notes: expense.notes ?? '',
      payNow: false,
      method: 'transfer',
      reference: '',
    });
    if (expense.paidAmount > 0) this.form.controls.locationId.disable();
    this.$document.set({ fileId: expense.documentFileId, url: expense.documentUrl });
    this.#prefilled.set(true);
  }

  #syncVat() {
    const { documentType, amount } = this.form.getRawValue();
    if (documentType !== 'invoice' || this.#vatEdited) return;
    this.form.controls.vatAmount.setValue(
      suggestedVat(Number(amount) || 0, this.#settings.$vatRate(), this.#settings.$currencyPrecision()),
    );
  }
}
