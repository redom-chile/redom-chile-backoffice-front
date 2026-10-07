import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, first, map, Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { toHttpParams } from '../../../data-access';

const BASE = `${ApiPathEnum.RESTAURANT}/products`;
const LOOKUP_PER_PAGE = 100;
// Tope al buscar la preparación de una variación (10.000 ingredientes).
const LOOKUP_MAX_PAGES = 100;

/** Ingrediente que podría ser una preparación (lo que usa la pantalla de producción). */
export type PreparationProduct = Readonly<{
  id: number;
  name: string;
  sku: string;
  unitId: number | null;
  variations: ReadonlyArray<Readonly<{ id: number; name: string }>>;
}>;

/** Busca preparaciones: ingredientes (GET /products?type=ingredient); la receta se revisa aparte. */
@Injectable({ providedIn: 'root' })
export class PreparationsService {
  readonly #http = inject(HttpClient);

  search(name: string, perPage = 20): Observable<PreparationProduct[]> {
    return this.#page(1, perPage, name.trim()).pipe(map((response) => response.data));
  }

  getProduct(productId: number): Observable<PreparationProduct> {
    return this.#http.get<PreparationProduct>(`${BASE}/${productId}`);
  }

  /** No hay endpoint variación → producto: se recorren los ingredientes hasta encontrarla. */
  findByVariation(variationId: number): Observable<PreparationProduct | null> {
    return this.#page(1, LOOKUP_PER_PAGE).pipe(
      expand((response) => {
        const { page, totalPages } = response.pagination;
        const found = response.data.some((product) => product.variations.some((variation) => variation.id === variationId));
        return !found && page < totalPages && page < LOOKUP_MAX_PAGES ? this.#page(page + 1, LOOKUP_PER_PAGE) : EMPTY;
      }),
      map((response) => response.data.find((product) => product.variations.some((variation) => variation.id === variationId)) ?? null),
      first((product) => product !== null, null),
    );
  }

  #page(page: number, perPage: number, name?: string): Observable<StandardizedPagination<PreparationProduct>> {
    return this.#http.get<StandardizedPagination<PreparationProduct>>(BASE, {
      params: toHttpParams({ page, perPage, type: 'ingredient', name: name || undefined }),
    });
  }
}
