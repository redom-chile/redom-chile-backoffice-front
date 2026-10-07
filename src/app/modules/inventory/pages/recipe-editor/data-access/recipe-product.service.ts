import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';

/**
 * GET /inventory/recipes no trae la unidad del producto: para el "Rinde" de una preparación
 * se lee de GET /products/:id.
 */
@Injectable({ providedIn: 'root' })
export class RecipeProductService {
  readonly #http = inject(HttpClient);

  getUnitId(productId: number): Observable<number | null> {
    return this.#http
      .get<{ unitId: number | null }>(`${ApiPathEnum.RESTAURANT}/products/${productId}`)
      .pipe(map((product) => product.unitId ?? null));
  }
}
