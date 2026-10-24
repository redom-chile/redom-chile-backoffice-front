import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { ProductDto, ReorderProductsDto } from './dtos';

const PAGE_SIZE = 100;

/** Orden manual de los productos de una categoría (etapa 8, #68). */
@Injectable({ providedIn: 'root' })
export class ReorderProductsService {
  readonly #http = inject(HttpClient);

  reorder(dto: ReorderProductsDto): Observable<unknown> {
    return this.#http.patch(`${ApiPathEnum.RESTAURANT}/products/reorder`, dto);
  }

  /**
   * Todos los productos que la carta muestra en esa categoría: los de una subcategoría van en la subcategoría
   * (el filtro del API trae también los de sus subcategorías).
   */
  getCategoryProducts(categoryId: number): Observable<ProductDto[]> {
    const page = (number: number) =>
      this.#http.get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, {
        params: new HttpParams().set('page', number).set('perPage', PAGE_SIZE).set('categoryId', categoryId),
      });
    return page(1).pipe(
      expand((response) => {
        const { page: current, totalPages } = response.pagination;
        return current < totalPages ? page(current + 1) : EMPTY;
      }),
      reduce((all, response) => [...all, ...response.data], [] as ProductDto[]),
      map((products) =>
        products.filter((product) => product.type !== 'modifier' && (product.subCategoryId || product.categoryId) === categoryId),
      ),
    );
  }
}
