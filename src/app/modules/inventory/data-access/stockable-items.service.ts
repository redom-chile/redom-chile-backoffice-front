import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { combineLatest, map, Observable, of } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { StockableItem } from './dtos';
import { toHttpParams } from './inventory.service';

// Variación "DUMMY": convención del backend para productos sin variaciones reales.
const DEFAULT_VARIATION_NAME = 'DUMMY';

type ProductForStock = Readonly<{
  id: number;
  name: string;
  sku: string;
  type: string | null;
  unitId: number | null;
  stockMode?: string;
  variations: ReadonlyArray<Readonly<{ id: number; name: string; defaultPurchasePrice: number | null }>>;
}>;

function toItems(product: ProductForStock, kind: StockableItem['kind']): StockableItem[] {
  return product.variations.map((variation) => ({
    productId: product.id,
    variationId: variation.id,
    label:
      product.variations.length > 1 && variation.name !== DEFAULT_VARIATION_NAME
        ? `${product.name} · ${variation.name}`
        : product.name,
    sku: product.sku,
    kind,
    unitId: product.unitId,
    defaultPurchasePrice: variation.defaultPurchasePrice,
  }));
}

/**
 * Busca ítems con stock propio para compras y ajustes:
 * ingredientes (GET /products?type=ingredient) + productos vendibles con stockMode "direct" (GET /products).
 */
@Injectable({ providedIn: 'root' })
export class StockableItemsService {
  readonly #http = inject(HttpClient);

  search(name: string, options: { includeIngredients: boolean }, perPage = 20): Observable<StockableItem[]> {
    const term = name.trim() || undefined;
    const ingredients$ = options.includeIngredients
      ? this.#fetch({ type: 'ingredient', name: term, page: 1, perPage }).pipe(
          map((products) => products.flatMap((product) => toItems(product, 'ingredient'))),
        )
      : of<StockableItem[]>([]);
    const products$ = this.#fetch({ name: term, page: 1, perPage: 100 }).pipe(
      map((products) =>
        products
          .filter((product) => product.stockMode === 'direct' && product.type !== 'ingredient')
          .slice(0, perPage)
          .flatMap((product) => toItems(product, 'product')),
      ),
    );
    return combineLatest([ingredients$, products$]).pipe(map(([ingredients, products]) => [...ingredients, ...products]));
  }

  #fetch(filters: object): Observable<ProductForStock[]> {
    return this.#http
      .get<StandardizedPagination<ProductForStock>>(`${ApiPathEnum.RESTAURANT}/products`, {
        params: toHttpParams(filters),
      })
      .pipe(map((response) => response.data));
  }
}
