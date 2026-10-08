import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { fromEvent, merge, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { ApiError } from 'src/app/core/utils';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ConfirmModalComponent, ConfirmModalData, EmptyStateComponent, IconComponent, ToastService, RedomLogoComponent } from 'src/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { BusinessLocationSelector } from 'src/app/modules/sectors/pages/sector-list/ui';
import { GetAllSectorsService } from 'src/app/modules/sectors/pages/sector-list/data-access';
import { GetAllTablesService, TableDto } from 'src/app/modules/tables/pages/table-list/data-access';
import { GetAllCategoriesService } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { GetOrderByIdService, OrderDetailDto } from 'src/app/modules/orders/pages/order-detail/data-access';
import {
  CollectPaymentModalComponent,
  CollectPaymentResult,
} from 'src/app/modules/orders/pages/order-detail/features';
import {
  AddOrderLinesService,
  CreateOrderService,
  CustomerDto,
  getOrderSaveErrorMessage,
  GetMenuProductsService,
  isModifierNotAvailableError,
  OrderProductDto,
} from 'src/app/modules/orders/pages/order-create/data-access';
import {
  addProductToCart,
  CartLine,
  CartNoteChange,
  changeCartQuantity,
  editCartLine,
  ProductPickerComponent,
  quantitiesByProduct,
  removeFromCart,
  setCartNote,
  toOrderProducts,
} from 'src/app/modules/orders/pages/order-create/features';
import { CashContextStore, CashIndicatorComponent } from 'src/app/modules/cash/features/cash-panel';
import { PosSessionService, PosWaiter } from './data-access';
import { PosOrderPanelComponent, PosTablesPanelComponent, WaiterLoginComponent } from './features';

@Component({
  selector: 'app-pos-terminal',
  standalone: true,
  imports: [RedomLogoComponent, 
    IconComponent,
    EmptyStateComponent,
    RouterLink,
    BusinessLocationSelector,
    WaiterLoginComponent,
    PosTablesPanelComponent,
    PosOrderPanelComponent,
    ProductPickerComponent,
    CashIndicatorComponent,
  ],
  templateUrl: './pos-terminal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosTerminalComponent implements OnInit, OnDestroy {
  // Terminal de salón: sucursal fija, sin entrar sin mesero, y se bloquea al enviar o por inactividad.
  readonly terminalMode = input(false);
  readonly fixedLocationId = input<number | null>(null);
  readonly inactivitySeconds = input(60);
  readonly locationName = input<string | null>(null);
  readonly locked = output<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly session = inject(PosSessionService);
  private readonly tablesService = inject(GetAllTablesService);
  private readonly sectorsService = inject(GetAllSectorsService);
  private readonly categoriesService = inject(GetAllCategoriesService);
  private readonly menuService = inject(GetMenuProductsService);
  private readonly orderService = inject(GetOrderByIdService);
  private readonly createService = inject(CreateOrderService);
  private readonly addLinesService = inject(AddOrderLinesService);
  // Caja del equipo (solo con el módulo de caja activo).
  private readonly cashContext = inject(CashContextStore);

  // Sin sucursales no se puede vender: se muestra cómo crear la primera (no aplica a la terminal, que tiene la suya).
  private readonly locationsService = inject(GetAllBusinessLocationsService);
  readonly $noLocations = computed(() => !this.terminalMode() && this.locationsService.$locations()?.length === 0);

  // Opciones del POS (Mi negocio → Punto de venta). Sin configurar (negocios antiguos), el POS se muestra completo.
  private readonly businessSettings = inject(BusinessSettingsService);
  readonly $showTables = computed(() => {
    const pos = this.businessSettings.$posSettings();
    return !pos.configured || pos.tablesEnabled;
  });
  // La terminal de salón siempre trabaja con meseros (PIN).
  readonly $useWaiters = computed(() => {
    const pos = this.businessSettings.$posSettings();
    return this.terminalMode() || !pos.configured || pos.waiterEnabled;
  });
  readonly $waiterRequired = computed(() => {
    const pos = this.businessSettings.$posSettings();
    return pos.configured && pos.waiterEnabled && pos.isServiceStaffRequired;
  });

  readonly $waiter = this.session.$waiter;
  readonly $isReady = computed(() => !!this.$waiter() || this.session.$isAnonymous());

  // Contexto: sucursal, mesa y cuenta abierta.
  readonly $locationId = signal<number | null>(null);
  readonly $table = signal<TableDto | null>(null);
  readonly $orderId = signal<number | null>(null);
  readonly $tables = this.tablesService.$tables;
  readonly $isLoadingTables = computed(() => this.tablesService.$isLoading() ?? false);
  readonly $sectors = computed(() => this.sectorsService.$sectors() ?? []);
  readonly $order = computed<OrderDetailDto | null>(() => {
    const order = this.orderService.$order();
    return order && order.transactionId === this.$orderId() ? order : null;
  });
  readonly $isLoadingOrder = computed(() => this.$orderId() !== null && !this.$order());

  // Pedido en curso.
  readonly $products = this.menuService.$products;
  readonly $isLoadingProducts = computed(() => this.menuService.$isLoading() ?? false);
  readonly $categories = computed(() => this.categoriesService.$categories() ?? []);
  readonly $selectedCategoryId = signal<number | null>(null);
  readonly $search = signal('');
  readonly $cart = signal<CartLine[]>([]);
  readonly $customer = signal<CustomerDto | null>(null);
  readonly $sendToKitchen = signal(true);
  readonly $quantities = computed(() => quantitiesByProduct(this.$cart()));
  readonly $kitchenNote = signal('');
  readonly $isSaving = computed(
    () => (this.createService.$isLoading() ?? false) || (this.addLinesService.$isLoading() ?? false),
  );
  readonly $panelTitle = computed(() => this.$table()?.name ?? 'Venta sin mesa');

  constructor() {
    // Sin meseros: se entra directo al POS, sin la pantalla "¿Quién atiende?".
    effect(() => {
      if (!this.$useWaiters() && !this.$isReady()) this.session.startAnonymous();
    });

    effect(() => {
      const created = this.createService.$created();
      if (!created) return;
      this.createService.reset();
      this.toast.show(`Pedido ${created.invoiceNo} enviado`, 'success');
      this.afterOrderSaved(created.transactionId);
    });

    effect(() => {
      if (!this.addLinesService.$success()) return;
      this.addLinesService.reset();
      this.toast.show('Productos agregados a la cuenta', 'success');
      this.afterOrderSaved(this.$orderId()!);
    });

    effect(() => {
      const error = this.createService.$error();
      if (error) this.handleSaveError(error, false);
    });

    effect(() => {
      const error = this.addLinesService.$error();
      if (error) this.handleSaveError(error, true);
    });
  }

  ngOnInit(): void {
    if (!this.$categories().length) this.categoriesService.getAll();
    this.loadProducts();

    if (!this.terminalMode()) return;
    // La terminal siempre parte bloqueada: nadie hereda la sesión del mesero anterior.
    this.session.end();
    const locationId = this.fixedLocationId();
    if (locationId) this.handleLocationChange(locationId);

    // Bloqueo por inactividad: cualquier toque o tecla reinicia la cuenta.
    merge(fromEvent(document, 'pointerdown'), fromEvent(document, 'keydown'), timer(0))
      .pipe(
        switchMap(() => timer(this.inactivitySeconds() * 1000)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.$waiter()) return;
        if (this.$cart().length) this.toast.show('Terminal bloqueada por inactividad: se descartaron los productos sin enviar', 'warning');
        this.lock();
      });
  }

  // Vuelve a la pantalla de PIN.
  lock() {
    this.resetOrder();
    this.session.end();
    this.locked.emit();
  }

  ngOnDestroy(): void {
    this.createService.reset();
    this.addLinesService.reset();
    this.cashContext.clear();
  }

  // --- Mesero ---
  handleLogin(waiter: PosWaiter) {
    this.session.start(waiter);
    this.toast.show(`Hola, ${waiter.name}`, 'success');
  }

  handleAnonymous() {
    this.session.startAnonymous();
  }

  handleChangeWaiter() {
    if (!this.$cart().length) {
      this.endSession();
      return;
    }
    this.dialog
      .open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
        width: '440px',
        maxWidth: '95vw',
        data: {
          title: 'Productos sin enviar',
          message: 'Si cambias de mesero se descartarán los productos que aún no enviaste.',
          confirmText: 'Descartar y cambiar',
          cancelText: 'Volver',
          tone: 'danger',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.endSession();
      });
  }

  private endSession() {
    if (this.terminalMode()) {
      this.lock();
      return;
    }
    this.resetOrder();
    this.session.end();
  }

  // --- Contexto ---
  handleLocationChange(locationId: number) {
    if (this.$locationId() === locationId) return;
    this.$locationId.set(locationId);
    this.cashContext.setLocation(locationId);
    this.tablesService.setParams(locationId);
    this.sectorsService.setParams({ locationId });
    this.selectCounter();
  }

  selectCounter() {
    this.$table.set(null);
    this.$orderId.set(null);
    this.$customer.set(null);
  }

  handleSelectTable(table: TableDto) {
    if (table.id === this.$table()?.id) return;
    this.$table.set(table);
    this.$customer.set(null);
    // La mesa trae su cuenta abierta más reciente (currentTransactionId): se agregan productos a esa.
    const orderId = table.currentTransactionId;
    this.$orderId.set(orderId);
    if (orderId) {
      this.orderService.load(orderId);
      return;
    }
    if (table.status === 'occupied') this.toast.show(`No se encontró la cuenta abierta de ${table.name}`, 'warning');
  }

  // --- Carta y ticket ---
  handleCategoryChange(categoryId: number | null) {
    this.$selectedCategoryId.set(categoryId);
    this.loadProducts();
  }

  handleSearchChange(search: string) {
    this.$search.set(search);
    this.loadProducts();
  }

  handleAdd(product: ProductDto) {
    addProductToCart(this.dialog, this.$cart, product);
  }

  handleEdit(key: string) {
    editCartLine(this.dialog, this.$cart, key, this.$products());
  }

  handleIncrement(key: string) {
    this.$cart.update((cart) => changeCartQuantity(cart, key, 1));
  }

  handleDecrement(key: string) {
    this.$cart.update((cart) => changeCartQuantity(cart, key, -1));
  }

  handleRemove(key: string) {
    this.$cart.update((cart) => removeFromCart(cart, key));
  }

  handleNote({ key, note }: CartNoteChange) {
    this.$cart.update((cart) => setCartNote(cart, key, note));
  }

  // --- Acciones ---
  handleSubmit() {
    const locationId = this.$locationId();
    if (!this.$cart().length || !locationId) return;
    // Cada producto lleva su nota; la nota general solo existe al abrir la cuenta.
    const products: OrderProductDto[] = toOrderProducts(this.$cart());

    const orderId = this.$orderId();
    if (orderId) {
      this.addLinesService.add({ orderId, products });
      return;
    }
    this.createService.create({
      locationId,
      products,
      resTableId: this.$table()?.id,
      resWaiterId: this.$waiter()?.code,
      contactId: this.$customer()?.id,
      isKitchenOrder: this.$sendToKitchen(),
      staffNote: this.$kitchenNote().trim() || undefined,
    });
  }

  handleCollect() {
    const order = this.$order();
    if (!order) return;
    this.dialog
      .open<CollectPaymentModalComponent, OrderDetailDto, CollectPaymentResult>(CollectPaymentModalComponent, {
        width: '600px',
        maxWidth: '95vw',
        disableClose: true,
        data: order,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'paid') {
          this.toast.show(`${this.$panelTitle()} pagada y cerrada`, 'success');
          this.tablesService.retry();
          if (this.terminalMode()) {
            this.lock();
            return;
          }
          this.selectCounter();
          return;
        }
        if (result === 'partial' && this.terminalMode()) {
          this.lock();
          return;
        }
        if (result === 'partial') this.orderService.retry();
      });
  }

  private afterOrderSaved(orderId: number) {
    this.$kitchenNote.set('');
    if (this.terminalMode()) {
      this.tablesService.retry();
      this.lock();
      return;
    }
    this.$cart.set([]);
    this.$customer.set(null);
    this.$orderId.set(orderId);
    this.orderService.load(orderId);
    this.tablesService.retry();
  }

  private resetOrder() {
    this.$cart.set([]);
    this.$kitchenNote.set('');
    this.selectCounter();
  }

  // El carrito se conserva; si una opción ya no existe se recarga la carta para volver a elegirla.
  private handleSaveError(error: ApiError, adding: boolean) {
    const productName = (productId: number) => this.$cart().find((line) => line.productId === productId)?.name;
    this.toast.show(getOrderSaveErrorMessage(error, adding, productName), 'error');
    if (isModifierNotAvailableError(error)) this.menuService.reload();
  }

  private loadProducts() {
    this.menuService.load({ categoryId: this.$selectedCategoryId(), name: this.$search() });
  }
}
