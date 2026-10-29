import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, forkJoin, map, Observable, reduce } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { sortForMenu } from 'src/app/modules/products/shared';
import { ProductDto, ReorderProductsDto } from './dtos';

const PAGE_SIZE = 100;

/**
 * Grupo de una categoría tal como lo valida el backend: todos sus productos no eliminados
 * (también inactivos, sets de modificadores e ingredientes). Solo los "visibles" se ordenan en pantalla.
 */
export type CategoryProductsGroup = Readonly<{ all: ProductDto[]; visible: ProductDto[] }>;

const isHidden = (product: ProductDto) => product.type === 'modifier' || product.type === 'ingredient';

/** Orden manual de los productos de una categoría (#68). */
@Injectable({ providedIn: 'root' })
export class ReorderProductsService {
  readonly #http = inject(HttpClient);

  reorder(dto: ReorderProductsDto): Observable<unknown> {
    return this.#http.patch(`${ApiPathEnum.RESTAURANT}/products/reorder`, dto);
  }

  /**
   * Los productos de la categoría (la subcategoría cuando tienen una). El filtro del API trae también
   * los de sus subcategorías y no trae ingredientes salvo que se pidan: se piden aparte.
   */
  getCategoryProducts(categoryId: number): Observable<CategoryProductsGroup> {
    return forkJoin([this.#fetchAll(categoryId), this.#fetchAll(categoryId, 'ingredient')]).pipe(
      map(([products, ingredients]) => {
        const all = sortForMenu(
          [...products, ...ingredients].filter((product) => (product.subCategoryId || product.categoryId) === categoryId),
          'manual',
        );
        return { all, visible: all.filter((product) => !isHidden(product)) };
      }),
    );
  }

  #fetchAll(categoryId: number, type?: string): Observable<ProductDto[]> {
    const page = (number: number) => {
      let params = new HttpParams().set('page', number).set('perPage', PAGE_SIZE).set('categoryId', categoryId);
      if (type) params = params.set('type', type);
      return this.#http.get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params });
    };
    return page(1).pipe(
      expand((response) => {
        const { page: current, totalPages } = response.pagination;
        return current < totalPages ? page(current + 1) : EMPTY;
      }),
      reduce((all, response) => [...all, ...response.data], [] as ProductDto[]),
    );
  }
}

/** Ids del grupo completo con los visibles en su nuevo orden; los ocultos conservan su lugar. */
export function mergeGroupOrder(all: readonly ProductDto[], visible: readonly ProductDto[]): number[] {
  const queue = visible.map((product) => product.id);
  return all.map((product) => (isHidden(product) ? product.id : queue.shift()!));
}
