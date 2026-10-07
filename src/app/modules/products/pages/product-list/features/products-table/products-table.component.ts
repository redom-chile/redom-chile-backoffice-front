import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { IconComponent, ImageThumbComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { STOCK_MODE_LABELS } from 'src/app/modules/inventory/data-access';
import { ProductDto } from '../../data-access';

@Component({
  selector: 'app-products-table',
  standalone: true,
  imports: [IconComponent, SkeletonComponent, PaginationTableComponent, ImageThumbComponent],
  templateUrl: './products-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsTableComponent {
  readonly products = input.required<ProductDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly categoryNames = input<Record<number, string>>({});
  readonly hasFilters = input(false);
  // Muestra el control de stock (solo con el inventario activo).
  readonly showStockMode = input(false);
  readonly stockModeLabels = STOCK_MODE_LABELS;

  readonly edit = output<ProductDto>();
  readonly delete = output<ProductDto>();
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();
  // Una imagen firmada venció: el contenedor vuelve a pedir la lista.
  readonly imageExpired = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly #currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

  price(product: ProductDto): string {
    const price = product.variations[0]?.sellPriceIncTax;
    return price === null || price === undefined ? '—' : this.#currency.format(price);
  }

  categoryLabel(product: ProductDto): string {
    const names = this.categoryNames();
    const category = product.categoryId ? names[product.categoryId] : undefined;
    const subcategory = product.subCategoryId ? names[product.subCategoryId] : undefined;
    return [category, subcategory].filter(Boolean).join(' › ') || 'Sin categoría';
  }
}
