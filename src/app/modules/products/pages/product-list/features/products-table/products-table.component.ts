import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSIONS } from 'src/app/core/permissions';
import { CheckPermissionDirective } from 'src/app/shared/directives';
import { PaginationMeta } from 'src/app/core/standarized-response/standardized-pagination/pagination-meta.dto';
import { IconComponent, ImageThumbComponent, PaginationTableComponent, SkeletonComponent } from 'src/ui';
import { STOCK_MODE_LABELS } from 'src/app/modules/inventory/data-access';
import { ProductDto } from '../../data-access';
import { activeVariations, MIN_VARIETIES } from '../../ui';

@Component({
  selector: 'app-products-table',
  standalone: true,
  imports: [RouterLink, IconComponent, SkeletonComponent, PaginationTableComponent, ImageThumbComponent, CheckPermissionDirective],
  templateUrl: './products-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsTableComponent {
  protected readonly PERMISSIONS = PERMISSIONS;
  readonly products = input.required<ProductDto[]>();
  readonly loading = input(false);
  readonly pagination = input<PaginationMeta | null>(null);
  readonly categoryNames = input<Record<number, string>>({});
  readonly hasFilters = input(false);
  // Muestra el control de stock (solo con el inventario activo).
  readonly showStockMode = input(false);
  // Acceso a la receta de los platos "Por receta" (inventario + ingredientes activos).
  readonly showRecipe = input(false);
  readonly stockModeLabels = STOCK_MODE_LABELS;

  readonly edit = output<ProductDto>();
  readonly delete = output<ProductDto>();
  readonly pageChange = output<number>();
  readonly clearFilters = output<void>();
  // Una imagen firmada venció: el contenedor vuelve a pedir la lista.
  readonly imageExpired = output<void>();

  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly #currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 });

  // Con variedades: "Desde $X" si los precios difieren.
  price(product: ProductDto): string {
    const prices = activeVariations(product)
      .map((variation) => variation.sellPriceIncTax)
      .filter((price): price is number => price !== null && price !== undefined);
    if (!prices.length) return '—';
    const min = Math.min(...prices);
    return prices.length > 1 && Math.max(...prices) !== min ? `Desde ${this.#currency.format(min)}` : this.#currency.format(min);
  }

  varietyCount(product: ProductDto): number {
    const count = activeVariations(product).length;
    return count >= MIN_VARIETIES ? count : 0;
  }

  categoryLabel(product: ProductDto): string {
    const names = this.categoryNames();
    const category = product.categoryId ? names[product.categoryId] : undefined;
    const subcategory = product.subCategoryId ? names[product.subCategoryId] : undefined;
    return [category, subcategory].filter(Boolean).join(' › ') || 'Sin categoría';
  }
}
