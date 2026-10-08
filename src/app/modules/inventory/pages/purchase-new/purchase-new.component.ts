import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, Observable, startWith, switchMap, throwError } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { readApiError } from 'src/app/core/utils/api-error';
import { getCashErrorMessage, PAYMENT_METHOD_LABELS, PaymentMethod } from 'src/app/modules/cash/data-access';
import { CashRetryService } from 'src/app/modules/cash/features/cash-retry';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService, ToggleComponent } from 'src/ui';
import {
  CreatePurchaseDto,
  formatMoney,
  getInventoryErrorMessage,
  InventoryDocumentResultDto,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  supplierDueDate,
  SupplierDto,
  supplierLabel,
  supplierPayTermLabel,
  SuppliersService,
  todayIsoDate,
  UnitsService,
} from '../../data-access';
import {
  CreateSupplierModalComponent,
  CreateSupplierModalResult,
  createStockLinesArray,
  StockLinesEditorComponent,
  toPurchaseLines,
} from '../../features';
import { formatDocumentDate } from '../../shared';
import { InventoryDisabledComponent, LocationSelectComponent } from '../../ui';

// El usuario cerró el modal de caja: no se muestra error.
const CANCELLED = Symbol('cancelled');

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'debit', 'credit', 'transfer', 'other'];

function positiveId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Nueva compra: ingresa stock con su costo. Query params opcionales: variationId, locationId. */
@Component({
  selector: 'app-purchase-new',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    LocationSelectComponent,
    StockLinesEditorComponent,
    ToggleComponent,
  ],
  templateUrl: './purchase-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseNewComponent implements OnInit {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #inventory = inject(InventoryService);
  readonly #suppliersService = inject(SuppliersService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  readonly #cashRetry = inject(CashRetryService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly supplierLabel = supplierLabel;
  protected readonly formatMoney = formatMoney;
  protected readonly formatDate = formatDocumentDate;
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;

  readonly form = this.#fb.group({
    supplierId: this.#fb.control<number | null>(null),
    referenceNo: ['', [Validators.maxLength(100)]],
    documentDate: [todayIsoDate(), [Validators.required]],
    notes: ['', [Validators.maxLength(1000)]],
    lines: createStockLinesArray(),
    // IVA de la factura: se suma al neto. Se sugiere neto × tasa mientras no se edite a mano.
    vatAmount: this.#fb.control<number | null>(0, [Validators.min(0)]),
    // Vacío = fecha + condiciones de pago del proveedor.
    dueDate: [''],
    paidNow: [false],
    paymentMethod: this.#fb.nonNullable.control<PaymentMethod>('cash'),
    paymentReference: ['', [Validators.maxLength(100)]],
  });

  readonly #formValue = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Neto de las líneas (cantidad × costo unitario). */
  readonly $netTotal = computed(() =>
    (this.#formValue().lines ?? []).reduce((sum, line) => {
      const quantity = Number(line.quantity);
      const cost = Number(line.unitCost);
      return Number.isFinite(quantity) && Number.isFinite(cost) ? sum + quantity * cost : sum;
    }, 0),
  );
  readonly $suggestedVat = computed(() => Math.round((this.$netTotal() * this.#settings.$vatRate()) / 100));
  readonly $vatAmount = computed(() => Math.max(0, Number(this.#formValue().vatAmount ?? 0) || 0));
  readonly $grossTotal = computed(() => this.$netTotal() + this.$vatAmount());
  readonly $paidNow = computed(() => !!this.#formValue().paidNow);
  readonly $vatRate = this.#settings.$vatRate;

  readonly $selectedSupplier = computed(() => {
    const id = this.#formValue().supplierId;
    return id ? (this.$suppliers().find((supplier) => supplier.id === id) ?? null) : null;
  });
  /** "Vacío = 30 días (condición del proveedor): 06-11-2026". */
  readonly $dueHint = computed(() => {
    const documentDate = this.#formValue().documentDate;
    const supplier = this.$selectedSupplier();
    if (!documentDate) return 'Vacío = según las condiciones de pago del proveedor.';
    const due = formatDocumentDate(supplierDueDate(documentDate, supplier));
    if (!supplier) return `Vacío = vence el mismo día (${due}).`;
    const term = supplierPayTermLabel(supplier);
    return term === 'Contado'
      ? `Vacío = vence el mismo día: el proveedor es de contado (${due}).`
      : `Vacío = ${term} (condición del proveedor): ${due}.`;
  });

  // Mientras el IVA no se edite a mano, sigue al neto.
  #vatEdited = false;

  readonly preselectVariationId = positiveId(this.#route.snapshot.queryParamMap.get('variationId'));

  readonly $suppliers = signal<SupplierDto[]>([]);
  readonly $suppliersLoading = signal(true);
  readonly $suppliersFailed = signal(false);
  readonly $isSaving = signal(false);
  readonly $submitted = signal(false);
  readonly #disabledByServer = signal(false);

  readonly $isDisabled = computed(
    () => this.#disabledByServer() || (this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled()),
  );
  readonly $isLoading = computed(
    () =>
      !this.#settings.$isLoaded() ||
      this.$suppliersLoading() ||
      (this.#units.$units() === null && !this.#units.$hasError()),
  );

  constructor() {
    this.form.controls.lines.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.#syncVat());
    this.form.controls.vatAmount.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.controls.vatAmount.dirty) this.#vatEdited = true;
    });
  }

  /** Vuelve a usar el IVA sugerido (neto × tasa). */
  resetVat() {
    this.#vatEdited = false;
    this.form.controls.vatAmount.markAsPristine();
    this.#syncVat();
  }

  setPaidNow(value: boolean) {
    this.form.controls.paidNow.setValue(value);
  }

  #syncVat() {
    if (this.#vatEdited) return;
    const net = this.form.controls.lines.controls.reduce((sum, line) => {
      const { quantity, unitCost } = line.getRawValue();
      return quantity !== null && unitCost !== null ? sum + Number(quantity) * Number(unitCost) : sum;
    }, 0);
    const vat = Math.round((net * this.#settings.$vatRate()) / 100);
    if (this.form.controls.vatAmount.value !== vat) this.form.controls.vatAmount.setValue(vat);
  }

  ngOnInit(): void {
    const locationId = positiveId(this.#route.snapshot.queryParamMap.get('locationId'));
    if (locationId) this.locationStore.select(locationId);
    this.#units.load();
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.$suppliersLoading.set(true);
    this.$suppliersFailed.set(false);
    this.#suppliersService
      .getAll()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (response) => {
          this.$suppliers.set(response.data);
          this.$suppliersLoading.set(false);
        },
        // Sin proveedores igual se puede registrar la compra (el proveedor es opcional).
        error: () => {
          this.$suppliersFailed.set(true);
          this.$suppliersLoading.set(false);
        },
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
        this.#toast.show('Proveedor creado', 'success');
      });
  }

  handleSubmit() {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    const locationId = this.locationStore.$locationId();
    if (!locationId) {
      this.#toast.show('Elige un local.', 'warning');
      return;
    }
    if (!this.form.controls.lines.length) {
      this.#toast.show('Agrega al menos un ítem.', 'warning');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#toast.show('Revisa los campos marcados.', 'warning');
      return;
    }

    const value = this.form.getRawValue();
    const referenceNo = value.referenceNo?.trim();
    const notes = value.notes?.trim();
    const paymentReference = value.paymentReference?.trim();
    const vatAmount = Math.max(0, Number(value.vatAmount ?? 0) || 0);
    const dto: CreatePurchaseDto = {
      locationId,
      ...(value.supplierId ? { supplierId: value.supplierId } : {}),
      ...(referenceNo ? { referenceNo } : {}),
      ...(value.documentDate ? { documentDate: value.documentDate } : {}),
      ...(notes ? { notes } : {}),
      vatAmount,
      ...(value.dueDate ? { dueDate: value.dueDate } : {}),
      lines: toPurchaseLines(this.form.controls.lines),
    };
    const method = value.paymentMethod;
    // Efectivo con la caja activa: sale del turno abierto de la caja de este equipo.
    const cashRegisterId = value.paidNow && method === 'cash' ? this.#cashRetry.deviceRegister(locationId) : undefined;

    this.$isSaving.set(true);
    this.#save(dto, value.paidNow ? { method, paymentReference, cashRegisterId } : null, locationId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.#toast.show(this.#successMessage(result), 'success');
          this.#router.navigate(['/inventory/documents', result.documentId]);
        },
        // Si falla (o se cancela la apertura de caja), el formulario queda intacto.
        error: (error) => {
          this.$isSaving.set(false);
          if (error === CANCELLED) return;
          if (isInventoryDisabledError(error)) {
            this.#disabledByServer.set(true);
            return;
          }
          const api = readApiError(error);
          this.#toast.show(
            api.code?.startsWith('CASH_') ? getCashErrorMessage(error) : getInventoryErrorMessage(error),
            'error',
          );
        },
      });
  }

  /** Crea la compra; si el pago en efectivo choca con la caja (cerrada o ambigua), lo resuelve y reintenta. */
  #save(
    dto: CreatePurchaseDto,
    payment: { method: PaymentMethod; paymentReference?: string; cashRegisterId?: number } | null,
    locationId: number,
  ): Observable<InventoryDocumentResultDto> {
    const body: CreatePurchaseDto = payment
      ? {
          ...dto,
          payment: {
            method: payment.method,
            ...(payment.cashRegisterId ? { cashRegisterId: payment.cashRegisterId } : {}),
            ...(payment.paymentReference ? { reference: payment.paymentReference } : {}),
          },
        }
      : dto;
    return this.#inventory.createPurchase(body).pipe(
      catchError((error: unknown) => {
        if (!payment || payment.method !== 'cash') return throwError(() => error);
        return this.#cashRetry
          .resolve(readApiError(error), {
            locationId,
            cashRegisterId: payment.cashRegisterId ?? null,
            purpose: 'Para pagar esta compra en efectivo, abre la caja.',
          })
          .pipe(
            switchMap((registerId) => {
              if (registerId === undefined) return throwError(() => error);
              if (registerId === null) return throwError(() => CANCELLED);
              return this.#save(dto, { ...payment, cashRegisterId: registerId }, locationId);
            }),
          );
      }),
    );
  }

  #successMessage(result: InventoryDocumentResultDto): string {
    const total = formatMoney(Number(result.totalCost ?? 0) + Number(result.vatAmount ?? 0));
    if (result.paymentStatus === 'paid') return `Compra registrada por ${total} · pagada`;
    if (result.paymentStatus === 'pending' || result.paymentStatus === 'partial') {
      const due = result.dueDate ? `, vence el ${formatDocumentDate(result.dueDate)}` : '';
      return `Compra registrada por ${total} · pendiente de pago${due}. Págala en Cuentas por pagar.`;
    }
    return `Compra registrada por ${total}`;
  }
}
