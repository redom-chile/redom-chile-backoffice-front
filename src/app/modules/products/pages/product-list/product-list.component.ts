import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { throttledRefresh } from 'src/app/core/services/file-upload';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { ButtonComponent, EmptyStateComponent, HeaderDashboardComponent, IconComponent, ToastService } from 'src/ui';
import { CategoryDto, GetAllCategoriesService } from '../categories/data-access';
import { GetAllProductsService, getProductErrorMessage, ProductDto } from './data-access';
import {
  CreateProductModalComponent,
  DeleteProductModalComponent,
  ProductModalResult,
  ProductsTableComponent,
  UpdateProductModalComponent,
} from './features';
import { FiltersProductTableComponent, ProductTableFilters } from './ui';

const PER_PAGE = 10;

type ProductListQuery = Readonly<{ page: number; search: string; categoryId: number | null }>;

function toQuery(params: ParamMap): ProductListQuery {
  const page = Number(params.get('page'));
  const categoryId = Number(params.get('category'));
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    search: params.get('search') ?? '',
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null,
  };
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    HeaderDashboardComponent,
    ButtonComponent,
    IconComponent,
    EmptyStateComponent,
    ProductsTableComponent,
    FiltersProductTableComponent,
  ],
  templateUrl: './product-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly getAllService = inject(GetAllProductsService);
  // Las URLs de imagen vencen en 1 hora: se vuelve a pedir la lista.
  protected readonly refreshExpiredImages = throttledRefresh(() => this.getAllService.retry());
  private readonly getAllCategoriesService = inject(GetAllCategoriesService);

  readonly $inventoryEnabled = inject(BusinessSettingsService).$inventoryEnabled;

  private readonly filtersComponent = viewChild(FiltersProductTableComponent);

  readonly $query = toSignal(this.route.queryParamMap.pipe(map(toQuery)), {
    initialValue: toQuery(this.route.snapshot.queryParamMap),
  });
  readonly initialFilters: ProductTableFilters = {
    search: this.$query().search,
    categoryId: this.$query().categoryId,
  };

  readonly $isLoading = computed(() => this.getAllService.$isLoading() ?? false);
  readonly $response = this.getAllService.$products;
  readonly $products = computed(() => this.$response()?.data ?? []);
  readonly $pagination = computed(() => this.$response()?.pagination ?? null);
  readonly $categories = computed(() => this.getAllCategoriesService.$categories() ?? []);
  readonly $errorMessage = computed(() => {
    const status = this.getAllService.$error();
    return status ? getProductErrorMessage(status) : null;
  });

  readonly $hasFilters = computed(() => !!this.$query().search || this.$query().categoryId !== null);
  readonly $isEmpty = computed(
    () =>
      !this.$isLoading() &&
      !this.$errorMessage() &&
      !this.$hasFilters() &&
      this.$response() !== undefined &&
      this.$pagination()?.totalItems === 0,
  );

  readonly $categoryNames = computed(() => {
    const names: Record<number, string> = {};
    const collect = (categories: CategoryDto[]) =>
      categories.forEach((category) => {
        names[category.id] = category.name;
        collect(category.subcategories ?? []);
      });
    collect(this.$categories());
    return names;
  });

  ngOnInit(): void {
    if (!this.$categories().length) this.getAllCategoriesService.getAll();

    this.route.queryParamMap
      .pipe(map(toQuery), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ page, search, categoryId }) =>
        this.getAllService.load({ page, perPage: PER_PAGE, name: search || undefined, categoryId: categoryId ?? undefined }),
      );
  }

  handleFiltersChange({ search, categoryId }: ProductTableFilters) {
    this.navigate({ page: null, search: search || null, category: categoryId });
  }

  handlePageChange(page: number) {
    this.navigate({ page: page > 1 ? page : null });
  }

  handleClearFilters() {
    this.filtersComponent()?.clear();
  }

  handleRetry() {
    this.getAllService.retry();
  }

  handleCreate() {
    this.dialog
      .open<CreateProductModalComponent, void, ProductModalResult>(CreateProductModalComponent, {
        width: '720px',
        maxWidth: '95vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  handleUpdate(product: ProductDto) {
    this.dialog
      .open<UpdateProductModalComponent, ProductDto, ProductModalResult>(UpdateProductModalComponent, {
        width: '720px',
        maxWidth: '95vw',
        disableClose: true,
        data: product,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  handleDelete(product: ProductDto) {
    this.dialog
      .open<DeleteProductModalComponent, ProductDto, ProductModalResult>(DeleteProductModalComponent, {
        width: '500px',
        maxWidth: '95vw',
        disableClose: true,
        data: product,
      })
      .afterClosed()
      .subscribe((result) => this.handleModalResult(result));
  }

  private handleModalResult(result: ProductModalResult | undefined) {
    const messages: Partial<Record<ProductModalResult, string>> = {
      created: 'Producto creado exitosamente',
      updated: 'Producto actualizado exitosamente',
      deleted: 'Producto eliminado exitosamente',
    };
    const message = result ? messages[result] : undefined;
    if (!message) return;
    this.toast.show(message, 'success');

    // Si se eliminó el último producto de la página, volver a la anterior.
    const { page } = this.$query();
    if (result === 'deleted' && page > 1 && this.$products().length === 1) {
      this.handlePageChange(page - 1);
      return;
    }
    this.getAllService.retry();
  }

  private navigate(queryParams: Record<string, string | number | null>) {
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
