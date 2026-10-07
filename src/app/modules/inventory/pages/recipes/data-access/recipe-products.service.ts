import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { toHttpParams } from '../../../data-access';

const PER_PAGE = 100;
// Tope de páginas por si el catálogo es muy grande (10.000 productos).
const MAX_PAGES = 100;

/** Plato con control "Por receta" (lo necesario para el listado de recetas). */
export type RecipeProduct = Readonly<{
  id: number;
  name: string;
  sku: string;
  type: string | null;
  stockMode?: string;
  isInactive?: boolean;
  variations: ReadonlyArray<Readonly<{ id: number; name: string }>>;
}>;

/**
 * GET /products no filtra por stockMode: se recorren las páginas y se filtran en el front
 * los productos "Por receta" (sin sets de modificadores ni ingredientes).
 */
@Injectable({ providedIn: 'root' })
export class RecipeProductsService {
  readonly #http = inject(HttpClient);

  listRecipeProducts(): Observable<RecipeProduct[]> {
    return this.#page(1).pipe(
      expand((response) => {
        const { page, totalPages } = response.pagination;
        return page < totalPages && page < MAX_PAGES ? this.#page(page + 1) : EMPTY;
      }),
      map((response) =>
        response.data.filter(
          (product) => product.stockMode === 'recipe' && product.type !== 'modifier' && product.type !== 'ingredient',
        ),
      ),
      reduce((all, products) => [...all, ...products], [] as RecipeProduct[]),
      map((products) => products.sort((a, b) => a.name.localeCompare(b.name, 'es'))),
    );
  }

  #page(page: number): Observable<StandardizedPagination<RecipeProduct>> {
    return this.#http.get<StandardizedPagination<RecipeProduct>>(`${ApiPathEnum.RESTAURANT}/products`, {
      params: toHttpParams({ page, perPage: PER_PAGE }),
    });
  }
}
