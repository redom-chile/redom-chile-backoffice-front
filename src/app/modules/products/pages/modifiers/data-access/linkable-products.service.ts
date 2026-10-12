import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { ProductDto } from '../../product-list/data-access/dtos';
import { LinkedProductDto } from './dtos';

// Los sets de modificadores e ingredientes no se pueden vincular a un set.
const EXCLUDED_TYPES = new Set(['modifier', 'ingredient']);
const PER_PAGE = 100;

export type LinkableProductsResult = Readonly<{ products: LinkedProductDto[]; hasMore: boolean }>;

/** Productos vendibles a los que se les puede vincular un set (hasta 100 por búsqueda). */
@Injectable({ providedIn: 'root' })
export class LinkableProductsService {
  readonly #http = inject(HttpClient);

  search(name: string): Observable<LinkableProductsResult> {
    let params = new HttpParams().set('page', 1).set('perPage', PER_PAGE).set('sellable', true);
    if (name.trim()) params = params.set('name', name.trim());
    return this.#http
      .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params })
      .pipe(
        map((response) => ({
          products: response.data
            .filter((product) => !EXCLUDED_TYPES.has(product.type ?? ''))
            .map((product) => ({ id: product.id, name: product.name })),
          hasMore: response.data.length >= PER_PAGE,
        })),
      );
  }
}
