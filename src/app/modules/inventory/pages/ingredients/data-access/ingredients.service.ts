import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { toHttpParams } from '../../../data-access';
import { CreateIngredientDto, IngredientDto, IngredientFiltersDto, UpdateIngredientDto } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/products`;

/** Ingredientes: mismos endpoints de productos filtrando por type=ingredient. */
@Injectable({ providedIn: 'root' })
export class IngredientsService {
  readonly #http = inject(HttpClient);

  list(filters: IngredientFiltersDto): Observable<StandardizedPagination<IngredientDto>> {
    return this.#http.get<StandardizedPagination<IngredientDto>>(BASE, {
      params: toHttpParams({ ...filters, type: 'ingredient' }),
    });
  }

  create(dto: CreateIngredientDto): Observable<{ id: number }> {
    return this.#http.post<{ id: number }>(BASE, dto);
  }

  update(id: number, dto: UpdateIngredientDto): Observable<unknown> {
    return this.#http.put(`${BASE}/${id}`, dto);
  }
}
