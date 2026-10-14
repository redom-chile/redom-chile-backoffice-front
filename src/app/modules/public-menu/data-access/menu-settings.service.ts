import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CategoryScheduleRangeDto,
  MenuSettingsDto,
  ProductAvailabilityDto,
  ProductTagDto,
  SlugAvailabilityDto,
  UpdateMenuSettingsDto,
  UpdateProductAvailabilityDto,
} from './dtos';

const REST = ApiPathEnum.RESTAURANT;

/** Administración de la carta pública (módulo de permisos public-menu). */
@Injectable({ providedIn: 'root' })
export class MenuSettingsService {
  readonly #http = inject(HttpClient);

  getSettings(locationId?: number): Observable<MenuSettingsDto[]> {
    return this.#http.get<MenuSettingsDto[]>(`${REST}/menu-settings`, { params: toHttpParams({ locationId }) });
  }

  update(locationId: number, dto: UpdateMenuSettingsDto): Observable<MenuSettingsDto> {
    return this.#http.patch<MenuSettingsDto>(`${REST}/menu-settings/${locationId}`, dto);
  }

  checkSlug(slug: string, locationId?: number): Observable<SlugAvailabilityDto> {
    return this.#http.get<SlugAvailabilityDto>(`${REST}/menu-settings/slug-availability`, { params: toHttpParams({ slug, locationId }) });
  }

  /** Afecta a todos los locales (no disponible en modo soporte). Devuelve la lista actualizada. */
  setBusinessSlug(slug: string): Observable<MenuSettingsDto[]> {
    return this.#http.put<MenuSettingsDto[]>(`${REST}/menu-settings/business-slug`, { slug });
  }

  setLocationSlug(locationId: number, slug: string): Observable<MenuSettingsDto> {
    return this.#http.put<MenuSettingsDto>(`${REST}/menu-settings/${locationId}/slug`, { slug });
  }

  getTags(): Observable<ProductTagDto[]> {
    return this.#http.get<ProductTagDto[]>(`${REST}/product-tags`);
  }

  /** Reemplaza la lista de etiquetas del producto. */
  setProductTags(productId: number, tagIds: number[]): Observable<unknown> {
    return this.#http.put(`${REST}/products/${productId}/tags`, { tagIds });
  }

  getAvailability(locationId: number): Observable<ProductAvailabilityDto[]> {
    return this.#http.get<ProductAvailabilityDto[]>(`${REST}/product-availability`, { params: toHttpParams({ locationId }) });
  }

  setAvailability(productId: number, dto: UpdateProductAvailabilityDto): Observable<unknown> {
    return this.#http.put(`${REST}/product-availability/${productId}`, dto);
  }

  setCategorySchedule(categoryId: number, ranges: CategoryScheduleRangeDto[]): Observable<unknown> {
    return this.#http.put(`${REST}/categories/${categoryId}/schedule`, { ranges });
  }
}
