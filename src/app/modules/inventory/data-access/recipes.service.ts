import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ProductRecipesDto, UpdateRecipeDto, UpdateRecipeResponseDto } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/inventory/recipes`;

/** Recetas de platos (por variación) y de opciones de modificador. */
@Injectable({ providedIn: 'root' })
export class RecipesService {
  readonly #http = inject(HttpClient);

  /** locationId es opcional: solo cambia los costos (por defecto, el promedio del negocio). */
  getByProduct(productId: number, locationId?: number | null): Observable<ProductRecipesDto> {
    let params = new HttpParams().set('productId', productId);
    if (locationId) params = params.set('locationId', locationId);
    return this.#http.get<ProductRecipesDto>(BASE, { params });
  }

  /** Reemplaza la receta completa de la variación (items: [] la borra). */
  update(variationId: number, dto: UpdateRecipeDto): Observable<UpdateRecipeResponseDto> {
    return this.#http.put<UpdateRecipeResponseDto>(`${BASE}/${variationId}`, dto);
  }
}
