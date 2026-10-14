import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { ProductDto } from './dtos';

// Un pack no puede incluir ingredientes, opciones de modificadores ni otros packs.
const NOT_IN_PACK = new Set(['modifier', 'ingredient', 'combo']);
const PER_PAGE = 50;
const DEFAULT_VARIATION_NAME = 'DUMMY';

/** Una variación que se puede agregar a un grupo del pack, con su precio de referencia (IVA incluido). */
export type PackOptionDto = Readonly<{
  variationId: number;
  productId: number;
  name: string;
  price: number | null;
}>;

/** Productos vendibles (y sus variaciones) para armar el contenido de un pack. */
@Injectable({ providedIn: 'root' })
export class PackOptionsService {
  readonly #http = inject(HttpClient);

  /** excludeProductId: el mismo pack (no puede contenerse a sí mismo). */
  search(name: string, excludeProductId: number | null): Observable<PackOptionDto[]> {
    let params = new HttpParams().set('page', 1).set('perPage', PER_PAGE).set('sellable', true);
    if (name.trim()) params = params.set('name', name.trim());
    return this.#http.get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params }).pipe(
      map((response) =>
        response.data
          .filter((product) => !NOT_IN_PACK.has(product.type ?? '') && product.id !== excludeProductId)
          .flatMap((product) => toOptions(product)),
      ),
    );
  }
}

function toOptions(product: ProductDto): PackOptionDto[] {
  const variations = product.variations.filter((variation) => variation.isActive !== false);
  return variations.map((variation) => ({
    variationId: variation.id,
    productId: product.id,
    name:
      variations.length > 1 && variation.name && ![DEFAULT_VARIATION_NAME, product.name].includes(variation.name)
        ? `${product.name} ${variation.name}`
        : product.name,
    price: variation.sellPriceIncTax ?? null,
  }));
}
