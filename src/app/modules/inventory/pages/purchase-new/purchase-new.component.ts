import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  formatMoney,
  getInventoryErrorMessage,
  InventoryLocationStore,
  InventoryService,
  isInventoryDisabledError,
  SupplierDto,
  supplierLabel,
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
import { InventoryDisabledComponent, LocationSelectComponent } from '../../ui';

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
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly supplierLabel = supplierLabel;

  readonly form = this.#fb.group({
    supplierId: this.#fb.control<number | null>(null),
    referenceNo: ['', [Validators.maxLength(100)]],
    documentDate: [todayIsoDate(), [Validators.required]],
    notes: ['', [Validators.maxLength(1000)]],
    lines: createStockLinesArray(),
  });

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
    this.$isSaving.set(true);
    this.#inventory
      .createPurchase({
        locationId,
        ...(value.supplierId ? { supplierId: value.supplierId } : {}),
        ...(referenceNo ? { referenceNo } : {}),
        ...(value.documentDate ? { documentDate: value.documentDate } : {}),
        ...(notes ? { notes } : {}),
        lines: toPurchaseLines(this.form.controls.lines),
      })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.#toast.show(`Compra registrada por ${formatMoney(result.totalCost)}`, 'success');
          this.#router.navigate(['/inventory/documents', result.documentId]);
        },
        // Si falla, el formulario queda intacto.
        error: (error) => {
          this.$isSaving.set(false);
          if (isInventoryDisabledError(error)) {
            this.#disabledByServer.set(true);
            return;
          }
          this.#toast.show(getInventoryErrorMessage(error), 'error');
        },
      });
  }
}
