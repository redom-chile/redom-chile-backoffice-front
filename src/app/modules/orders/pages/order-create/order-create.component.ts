import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { EntitlementsService, PlanUpsellService } from 'src/app/core/services/entitlements';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ApiError } from 'src/app/core/utils';
import { ButtonComponent, EmptyStateComponent, IconComponent, ToastService } from 'src/ui';
import { GetAllBusinessLocationsService } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { GetAllTablesService } from 'src/app/modules/tables/pages/table-list/data-access';
import { BusinessLocationSelector } from 'src/app/modules/sectors/pages/sector-list/ui';
import { GetAllCategoriesService } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { GetServiceStaffService } from '../order-list/data-access';
import { GetOrderByIdService } from '../order-detail/data-access';
import {
  AddOrderLinesService,
  CreateOrderService,
  CustomerDto,
  getOrderSaveErrorMessage,
  GetMenuProductsService,
  isModifierNotAvailableError,
  OrderProductDto,
} from './data-access';
import {
  addProductToCart,
  CartLine,
  CartNoteChange,
  changeCartQuantity,
  CustomerSelectorComponent,
  editCartLine,
  OrderTicketComponent,
  ProductPickerComponent,
  quantitiesByProduct,
  removeFromCart,
  setCartNote,
  toOrderProducts,
} from './features';

type OrderCreateMode = 'create' | 'add';

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    BusinessLocationSelector,
    ProductPickerComponent,
    OrderTicketComponent,
    CustomerSelectorComponent,
  ],
  templateUrl: './order-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderCreateComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly entitlements = inject(EntitlementsService);
  private readonly upsell = inject(PlanUpsellService);
  private readonly dialog = inject(MatDialog);
  private readonly createService = inject(CreateOrderService);
  private readonly addLinesService = inject(AddOrderLinesService);
  private readonly menuService = inject(GetMenuProductsService);
  private readonly tablesService = inject(GetAllTablesService);
  private readonly categoriesService = inject(GetAllCategoriesService);
  private readonly staffService = inject(GetServiceStaffService);
  private readonly orderService = inject(GetOrderByIdService);

  readonly mode: OrderCreateMode = this.route.snapshot.data['mode'] === 'add' ? 'add' : 'create';
  readonly $orderId = signal<number | null>(null);
  readonly $locationId = signal<number | null>(null);
  // Sin sucursales no se puede abrir un pedido: se muestra cómo crear la primera.
  private readonly locationsService = inject(GetAllBusinessLocationsService);
  readonly $noLocations = computed(() => this.mode === 'create' && this.locationsService.$locations()?.length === 0);

  readonly $products = this.menuService.$products;
  readonly $isLoadingProducts = computed(() => this.menuService.$isLoading() ?? false);
  readonly $categories = computed(() => this.categoriesService.$categories() ?? []);
  readonly $tables = this.tablesService.$tables;
  readonly $staff = this.staffService.$staff;
  readonly $order = computed(() => {
    const order = this.orderService.$order();
    return order && order.transactionId === this.$orderId() ? order : null;
  });

  readonly $selectedCategoryId = signal<number | null>(null);
  readonly $search = signal('');
  readonly $cart = signal<CartLine[]>([]);
  readonly $customer = signal<CustomerDto | null>(null);
  readonly $quantities = computed(() => quantitiesByProduct(this.$cart()));

  readonly form = inject(FormBuilder).group({
    resTableId: [null as number | null],
    resWaiterId: [null as string | null],
    isKitchenOrder: [true],
    kitchenNote: [''],
  });

  readonly $isSaving = computed(() =>
    this.mode === 'add' ? (this.addLinesService.$isLoading() ?? false) : (this.createService.$isLoading() ?? false),
  );
  // Qué falta para poder confirmar; se muestra junto al botón.
  readonly $missing = computed(() => {
    if (!this.$cart().length) return 'Agrega al menos un producto';
    if (this.mode === 'create' && !this.$locationId()) return 'Selecciona una sucursal';
    return null;
  });

  readonly inputClass = 'glass-input w-full rounded-md px-3 py-2';

  constructor() {
    effect(() => {
      const created = this.createService.$created();
      if (created) {
        this.toast.show(`Pedido ${created.invoiceNo} creado`, 'success');
        this.router.navigate(['/orders', created.transactionId]);
      }
    });

    effect(() => {
      if (this.addLinesService.$success()) {
        this.toast.show('Productos agregados al pedido', 'success');
        this.router.navigate(['/orders', this.$orderId()]);
      }
    });

    effect(() => {
      const error = this.createService.$error();
      if (error) this.handleSaveError(error, false);
    });

    effect(() => {
      const error = this.addLinesService.$error();
      if (error) this.handleSaveError(error, true);
    });

    effect(() => {
      const locationId = this.$locationId();
      if (locationId) this.tablesService.setParams(locationId);
    });
  }

  ngOnInit(): void {
    this.staffService.load();
    if (!this.$categories().length) this.categoriesService.getAll();
    this.loadProducts();

    if (this.mode === 'add') {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      this.$orderId.set(id);
      this.orderService.load(id);
      return;
    }

    const query = this.route.snapshot.queryParamMap;
    const locationId = Number(query.get('location'));
    const tableId = Number(query.get('table'));
    if (locationId > 0) this.$locationId.set(locationId);
    if (tableId > 0) this.form.controls.resTableId.setValue(tableId);
  }

  ngOnDestroy(): void {
    this.createService.reset();
    this.addLinesService.reset();
  }

  handleLocationChange(locationId: number) {
    if (this.$locationId() === locationId) return;
    this.$locationId.set(locationId);
    this.form.controls.resTableId.setValue(null);
  }

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

  handleSubmit() {
    const missing = this.$missing();
    if (missing) {
      this.toast.show(missing, 'warning');
      return;
    }
    // Cada producto lleva su nota; la nota general solo existe al crear el pedido.
    const products: OrderProductDto[] = toOrderProducts(this.$cart());

    if (this.mode === 'add') {
      this.addLinesService.add({ orderId: this.$orderId()!, products });
      return;
    }

    if (this.entitlements.isLocked('locations', this.$locationId())) {
      this.upsell.open({ resource: 'locations' });
      return;
    }

    const { resTableId, resWaiterId, isKitchenOrder, kitchenNote } = this.form.getRawValue();
    this.createService.create({
      locationId: this.$locationId()!,
      contactId: this.$customer()?.id,
      products,
      resTableId: resTableId ?? undefined,
      resWaiterId: resWaiterId ?? undefined,
      isKitchenOrder: !!isKitchenOrder,
      staffNote: kitchenNote?.trim() || undefined,
    });
  }

  // El carrito se conserva; si una opción ya no existe se recarga la carta para volver a elegirla.
  private handleSaveError(error: ApiError, adding: boolean) {
    // Error de plan (p. ej. local en solo lectura): ya lo muestra el modal global.
    if (error.code?.startsWith('PLAN_')) return;
    const productName = (productId: number) => this.$cart().find((line) => line.productId === productId)?.name;
    this.toast.show(getOrderSaveErrorMessage(error, adding, productName), 'error');
    if (isModifierNotAvailableError(error)) this.menuService.reload();
  }

  private loadProducts() {
    this.menuService.load({ categoryId: this.$selectedCategoryId(), name: this.$search() });
  }
}
