import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, HeaderDashboardComponent, IconComponent, SkeletonComponent, ToastService } from 'src/ui';
import {
  InventoryLocationStore,
  isInventoryDisabledError,
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  PurchaseOrderLineInputDto,
  PurchaseOrdersService,
  SavePurchaseOrderDto,
  StockableItem,
  StockableItemsService,
  SupplierDto,
  supplierLabel,
  SuppliersService,
  todayIsoDate,
  UnitDto,
  UnitsService,
} from '../../data-access';
import {
  CreateSupplierModalComponent,
  CreateSupplierModalResult,
  createStockLinesArray,
  StockLinesArray,
  StockLinesEditorComponent,
} from '../../features';
import { resultError, resultValue, toRemoteResult } from '../../shared';
import { InventoryDisabledComponent } from '../../ui';
import { getPurchaseOrderErrorMessage, isOrderEditable, PURCHASE_ORDER_STATUS_LABELS } from '../purchase-order-detail/data-access';

type EditData = Readonly<{ order: PurchaseOrderDto; items: StockableItem[] }>;
type SaveStatus = 'draft' | 'sent';

// Para reconocer los ítems de una orden existente (no hay búsqueda por id).
const EDIT_CATALOG_SIZE = 100;

function expectedAfterOrder(group: AbstractControl): ValidationErrors | null {
  const orderDate = group.get('orderDate')?.value;
  const expectedDate = group.get('expectedDate')?.value;
  return orderDate && expectedDate && expectedDate < orderDate ? { expectedBeforeOrder: true } : null;
}

// unitId solo si es una subunidad (distinta a la unidad del producto).
function toOrderLines(lines: StockLinesArray): PurchaseOrderLineInputDto[] {
  return lines.controls.map((line) => {
    const { item, quantity, unitId, unitCost } = line.getRawValue();
    const subUnitId = unitId && unitId !== item.unitId ? unitId : null;
    return {
      variationId: item.variationId,
      quantity: Number(quantity),
      ...(subUnitId ? { unitId: subUnitId } : {}),
      unitCost: Number(unitCost ?? 0),
    };
  });
}

/** Ítem de la orden para el editor; si no está en el catálogo cargado se arma con lo que trae la línea. */
function lineItem(line: PurchaseOrderLineDto, catalog: ReadonlyMap<number, StockableItem>, units: readonly UnitDto[]): StockableItem {
  const known = catalog.get(line.variationId);
  if (known) return known;
  const unit = line.unitId ? units.find((candidate) => candidate.id === line.unitId) : undefined;
  return {
    productId: line.productId,
    variationId: line.variationId,
    label: line.itemName,
    sku: '',
    kind: 'product',
    unitId: unit?.baseUnitId ?? line.unitId,
    defaultPurchasePrice: null,
  };
}

/**
 * Nueva orden de compra o edición (solo borrador/enviada). La orden no mueve stock:
 * se guarda como borrador o enviada y después se recibe desde el detalle.
 */
@Component({
  selector: 'app-purchase-order-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    SkeletonComponent,
    InventoryDisabledComponent,
    StockLinesEditorComponent,
  ],
  templateUrl: './purchase-order-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'handleBeforeUnload($event)' },
})
export class PurchaseOrderFormComponent {
  readonly #fb = inject(FormBuilder);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #toast = inject(ToastService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #orders = inject(PurchaseOrdersService);
  readonly #suppliersService = inject(SuppliersService);
  readonly #itemsService = inject(StockableItemsService);
  readonly #units = inject(UnitsService);
  readonly #settings = inject(BusinessSettingsService);
  protected readonly locationStore = inject(InventoryLocationStore);

  protected readonly supplierLabel = supplierLabel;
  protected readonly getErrorMessage = getPurchaseOrderErrorMessage;

  readonly form = this.#fb.group(
    {
      locationId: this.#fb.control<number | null>(null, Validators.required),
      supplierId: this.#fb.control<number | null>(null),
      referenceNo: ['', [Validators.maxLength(100)]],
      orderDate: [todayIsoDate(), [Validators.required]],
      expectedDate: [''],
      notes: ['', [Validators.maxLength(1000)]],
      lines: createStockLinesArray(),
    },
    { validators: expectedAfterOrder },
  );

  private readonly editorRef = viewChild(StockLinesEditorComponent);

  // Edición: /inventory/purchase-orders/:id/edit.
  readonly orderId = (() => {
    const id = Number(this.#route.snapshot.paramMap.get('id'));
    return Number.isInteger(id) && id > 0 ? id : null;
  })();
  readonly isEdit = this.orderId !== null;

  readonly $suppliers = signal<SupplierDto[]>([]);
  readonly $suppliersLoading = signal(true);
  readonly $suppliersFailed = signal(false);
  readonly $savingStatus = signal<SaveStatus | null>(null);
  readonly $submitted = signal(false);
  readonly $prefilled = signal(!this.isEdit);
  readonly #saved = signal(false);
  readonly #disabledByServer = signal(false);
  // Foto del formulario al terminar de cargar (para saber si hay cambios sin guardar).
  #baseline: string | null = this.isEdit ? null : this.#snapshot();

  readonly editData = rxResource({
    params: () => {
      if (!this.isEdit || !this.#settings.$isLoaded() || !this.#settings.$inventoryEnabled()) return undefined;
      return { id: this.orderId!, includeIngredients: this.#settings.$ingredientsEnabled() };
    },
    stream: ({ params }) =>
      forkJoin({
        order: this.#orders.get(params.id),
        // Si el catálogo falla igual se puede editar (los ítems se arman desde la línea).
        items: this.#itemsService
          .search('', { includeIngredients: params.includeIngredients }, EDIT_CATALOG_SIZE)
          .pipe(catchError(() => of<StockableItem[]>([]))),
      }).pipe(toRemoteResult<EditData>()),
  });

  readonly $editOrder = computed(() => resultValue(this.editData.value())?.order ?? null);
  readonly $editError = computed(() => resultError(this.editData.value()));

  readonly $isDisabled = computed(
    () =>
      this.#disabledByServer() ||
      isInventoryDisabledError(this.$editError()) ||
      (this.#settings.$isLoaded() && !this.#settings.$inventoryEnabled()),
  );
  readonly $isLoading = computed(
    () =>
      !this.#settings.$isLoaded() ||
      this.$suppliersLoading() ||
      (this.#units.$units() === null && !this.#units.$hasError()) ||
      (this.isEdit && !this.$editOrder() && !this.$editError()),
  );
  // Edición: la orden cargada sigue en borrador o enviada.
  readonly $canEditLoaded = computed(() => {
    const order = this.$editOrder();
    return !!order && isOrderEditable(order.status);
  });
  readonly $isSaving = computed(() => this.$savingStatus() !== null);
  readonly $title = computed(() => (this.isEdit ? `Editar orden #${this.orderId}` : 'Nueva orden de compra'));
  readonly $backLink = computed(() => (this.isEdit ? ['/inventory/purchase-orders', this.orderId] : ['/inventory/purchase-orders']));
  // En edición, "marcar como enviada" solo tiene sentido si sigue en borrador.
  readonly $canSend = computed(() => !this.isEdit || this.$editOrder()?.status === 'draft');

  constructor() {
    this.#units.load();
    this.loadSuppliers();

    // Nueva: toma el local elegido en inventario.
    effect(() => {
      const locationId = this.locationStore.$locationId();
      if (this.isEdit || !locationId) return;
      untracked(() => {
        const control = this.form.controls.locationId;
        if (control.value === null) control.setValue(locationId);
      });
    });

    // Edición: solo borrador o enviada; si no, al detalle.
    effect(() => {
      const order = this.$editOrder();
      if (!order) return;
      untracked(() => {
        if (isOrderEditable(order.status)) return;
        this.#saved.set(true);
        this.#toast.show(`Una orden ${PURCHASE_ORDER_STATUS_LABELS[order.status].toLowerCase()} ya no se puede editar.`, 'warning');
        this.#router.navigate(['/inventory/purchase-orders', order.id], { replaceUrl: true });
      });
    });

    // Edición: precarga cabecera y líneas cuando el editor ya está en pantalla.
    effect(() => {
      const editor = this.editorRef();
      const data = resultValue(this.editData.value());
      const units = this.#units.$units();
      if (!editor || !data || this.$prefilled() || !isOrderEditable(data.order.status)) return;
      untracked(() => this.#prefill(editor, data, units ?? []));
    });
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
        // El proveedor es opcional: sin la lista igual se puede guardar.
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
        this.form.controls.supplierId.markAsDirty();
        this.#toast.show('Proveedor creado', 'success');
      });
  }

  hasUnsavedChanges(): boolean {
    if (this.#saved() || !this.$prefilled()) return false;
    return this.form.dirty || this.#snapshot() !== this.#baseline;
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    // Navegadores antiguos requieren returnValue.
    event.returnValue = '';
  }

  handleSubmit(status: SaveStatus) {
    if (this.$isSaving()) return;
    this.$submitted.set(true);
    if (this.form.controls.locationId.invalid) {
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

    this.$savingStatus.set(status);
    const request$: Observable<PurchaseOrderDto> = this.isEdit
      ? this.#orders.update(this.orderId!, this.#toDto(true))
      : this.#orders.create({ ...this.#toDto(false), status });

    request$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe({
      next: (order) => {
        // En edición, "Guardar y marcar como enviada" cambia el estado después de guardar.
        if (this.isEdit && status === 'sent' && order.status === 'draft') {
          this.#markAsSent(order);
          return;
        }
        this.#finish(order, this.isEdit ? 'Cambios guardados' : status === 'sent' ? 'Orden creada y marcada como enviada' : 'Borrador guardado');
      },
      // Si falla, el formulario queda intacto.
      error: (error) => {
        this.$savingStatus.set(null);
        if (isInventoryDisabledError(error)) {
          this.#disabledByServer.set(true);
          return;
        }
        this.#toast.show(getPurchaseOrderErrorMessage(error), 'error');
      },
    });
  }

  // ---------- Privados ----------

  #markAsSent(order: PurchaseOrderDto) {
    this.#orders
      .changeStatus(order.id, 'sent')
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (updated) => this.#finish(updated, 'Cambios guardados y orden marcada como enviada'),
        error: (error) => {
          this.#toast.show(`Cambios guardados, pero no se pudo marcar como enviada: ${getPurchaseOrderErrorMessage(error)}`, 'warning');
          this.#finish(order, null);
        },
      });
  }

  #finish(order: PurchaseOrderDto, message: string | null) {
    this.#saved.set(true);
    if (message) this.#toast.show(message, 'success');
    this.#router.navigate(['/inventory/purchase-orders', order.id]);
  }

  /** En PUT se reemplaza la cabecera: los vacíos van en null y la fecha siempre (si falta vuelve a hoy). */
  #toDto(clearEmpty: boolean): SavePurchaseOrderDto {
    const value = this.form.getRawValue();
    const optional = <T>(key: string, v: T | null | undefined | '') =>
      v !== null && v !== undefined && v !== '' ? { [key]: v } : clearEmpty ? { [key]: null } : {};
    return {
      locationId: value.locationId!,
      ...optional('supplierId', value.supplierId),
      ...optional('referenceNo', value.referenceNo?.trim()),
      orderDate: value.orderDate || todayIsoDate(),
      ...optional('expectedDate', value.expectedDate),
      ...optional('notes', value.notes?.trim()),
      lines: toOrderLines(this.form.controls.lines),
    };
  }

  #prefill(editor: StockLinesEditorComponent, data: EditData, units: readonly UnitDto[]) {
    const { order, items } = data;
    this.form.patchValue({
      locationId: order.locationId,
      supplierId: order.supplierId,
      referenceNo: order.referenceNo ?? '',
      orderDate: order.orderDate.slice(0, 10),
      expectedDate: order.expectedDate?.slice(0, 10) ?? '',
      notes: order.notes ?? '',
    });
    // Proveedor que ya no está en la lista: se agrega para no perderlo al guardar.
    if (order.supplierId && !this.$suppliers().some((supplier) => supplier.id === order.supplierId)) {
      this.$suppliers.update((suppliers) => [
        ...suppliers,
        {
          id: order.supplierId!,
          type: 'supplier',
          name: order.supplierName ?? `Proveedor #${order.supplierId}`,
          mobile: '',
          email: null,
          supplierBusinessName: null,
          taxNumber: null,
        } as SupplierDto,
      ]);
    }

    const catalog = new Map(items.map((item) => [item.variationId, item]));
    const lines = this.form.controls.lines;
    lines.clear();
    for (const orderLine of order.lines) {
      const item = lineItem(orderLine, catalog, units);
      if (!editor.addItem(item)) continue;
      const line = lines.at(lines.length - 1);
      // Primero la unidad (el editor recalcula el costo sugerido) y después cantidad y costo de la orden.
      if (orderLine.unitId && orderLine.unitId !== line.controls.unitId.value) line.controls.unitId.setValue(orderLine.unitId);
      line.controls.quantity.setValue(orderLine.quantity);
      line.controls.unitCost.setValue(orderLine.unitCost);
    }
    this.form.markAsPristine();
    this.#baseline = this.#snapshot();
    this.$prefilled.set(true);
  }

  #snapshot(): string {
    const { locationId, lines, ...header } = this.form.getRawValue();
    return JSON.stringify({
      ...header,
      lines: lines.map(({ item, quantity, unitId, unitCost }) => [item.variationId, quantity, unitId, unitCost]),
    });
  }
}
