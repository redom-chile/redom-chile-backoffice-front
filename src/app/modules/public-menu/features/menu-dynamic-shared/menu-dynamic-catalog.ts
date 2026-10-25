import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { variationLabel } from 'src/app/modules/inventory/shared/data-access';
import { CategoryDto } from 'src/app/modules/products/pages/categories/data-access';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { formatMenuPrice } from 'src/app/modules/public-menu/data-access';
import { ApiPathEnum } from 'src/environments';

export type CatalogVariation = Readonly<{ id: number; label: string; price: number | null }>;

export type CatalogProduct = Readonly<{
  id: number;
  name: string;
  /** Rango de precios con IVA ("$4.990" o "$3.990 – $5.990"). */
  priceLabel: string | null;
  variations: readonly CatalogVariation[];
}>;

export type CatalogCategory = Readonly<{ id: number; name: string }>;

/** Productos vendibles y categorías del negocio, para elegir y para mostrar nombres en las listas. */
export type MenuDynamicCatalog = Readonly<{
  products: readonly CatalogProduct[];
  categories: readonly CatalogCategory[];
  productById: ReadonlyMap<number, CatalogProduct>;
  categoryById: ReadonlyMap<number, CatalogCategory>;
}>;

// Máximo por página del backend; tope de páginas para no colgar la pantalla con catálogos enormes.
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

@Injectable({ providedIn: 'root' })
export class MenuDynamicCatalogService {
  readonly #http = inject(HttpClient);

  load(): Observable<MenuDynamicCatalog> {
    return forkJoin([this.#products(), this.#http.get<CategoryDto[]>(`${ApiPathEnum.RESTAURANT}/categories`)]).pipe(
      map(([products, categories]) => {
        const flat = categories.flatMap((category) => [
          { id: category.id, name: category.name },
          ...(category.subcategories ?? []).map((sub) => ({ id: sub.id, name: `${category.name} › ${sub.name}` })),
        ]);
        const list = products.filter((product) => product.type !== 'modifier' && product.type !== 'ingredient').map(toCatalogProduct);
        return {
          products: list,
          categories: flat,
          productById: new Map(list.map((product) => [product.id, product])),
          categoryById: new Map(flat.map((category) => [category.id, category])),
        };
      }),
    );
  }

  #page(page: number): Observable<StandardizedPagination<ProductDto>> {
    const params = new HttpParams().set('page', page).set('perPage', PAGE_SIZE).set('isActive', true).set('sellable', true);
    return this.#http.get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params });
  }

  #products(): Observable<ProductDto[]> {
    return this.#page(1).pipe(
      switchMap((first) => {
        const total = Math.min(first.pagination?.totalPages ?? 1, MAX_PAGES);
        if (total <= 1) return of(first.data);
        const rest = Array.from({ length: total - 1 }, (_, index) => this.#page(index + 2));
        return forkJoin(rest).pipe(map((pages) => [...first.data, ...pages.flatMap((page) => page.data)]));
      }),
    );
  }
}

function toCatalogProduct(product: ProductDto): CatalogProduct {
  const variations = product.variations
    .filter((variation) => variation.isActive !== false)
    .map((variation) => ({ id: variation.id, label: variationLabel(variation.name) ?? product.name, price: variation.sellPriceIncTax }));
  const prices = variations.map((variation) => variation.price).filter((price): price is number => price !== null);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const priceLabel = min === null || max === null ? null : min === max ? formatMenuPrice(min) : `${formatMenuPrice(min)} – ${formatMenuPrice(max)}`;
  return { id: product.id, name: product.name, priceLabel, variations };
}

export function productName(catalog: MenuDynamicCatalog | null, id: number): string {
  return catalog?.productById.get(id)?.name ?? `Producto #${id}`;
}

export function categoryName(catalog: MenuDynamicCatalog | null, id: number): string {
  return catalog?.categoryById.get(id)?.name ?? `Categoría #${id}`;
}

/** "Papas fritas, Bebida y 2 más". */
export function namesSummary(names: readonly string[], max = 2): string {
  if (!names.length) return '';
  if (names.length <= max) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return `${names.slice(0, max).join(', ')} y ${names.length - max} más`;
}
