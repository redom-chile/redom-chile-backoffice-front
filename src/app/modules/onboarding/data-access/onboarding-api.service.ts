import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import {
  BusinessDto,
  CreateBusinessDto,
  CreateBusinessResponseDto,
} from 'src/app/modules/restaurante/pages/business/data-access';
import { CreateBusinessLocationDto } from 'src/app/modules/restaurante/pages/business-location/data-access';
import { CreateSectorDto } from 'src/app/modules/sectors/pages/sector-list/data-access';
import { CreateTableDto } from 'src/app/modules/tables/pages/table-list/data-access';
import { CreateProductDto } from 'src/app/modules/products/pages/product-list/data-access';

type CreatedDto = Readonly<{ id: number }>;

/**
 * Llamadas del onboarding como Observables simples: el asistente necesita los ids creados
 * (local → sector → mesas), cosa que los servicios con estado de cada módulo no exponen.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingApiService {
  readonly #http = inject(HttpClient);
  readonly #base = ApiPathEnum.RESTAURANT;

  /** Crea el negocio ya activo y, si se envía `location`, su primer local en la misma transacción. */
  createBusiness(dto: CreateBusinessDto): Observable<CreateBusinessResponseDto> {
    return this.#http.post<CreateBusinessResponseDto>(`${this.#base}/business`, dto);
  }

  // Solo cambia la opción enviada (el resto de pos_settings se conserva).
  updateTablesEnabled(businessId: number, tablesEnabled: boolean): Observable<unknown> {
    return this.#http.patch(`${this.#base}/business/${businessId}/settings`, { posSettings: { tablesEnabled } });
  }

  findBusiness(businessId: number): Observable<BusinessDto | null> {
    return this.#http
      .get<BusinessDto[]>(`${this.#base}/business/my-businesses`)
      .pipe(map((businesses) => businesses.find((business) => business.id === businessId) ?? null));
  }

  createLocation(dto: CreateBusinessLocationDto): Observable<CreatedDto> {
    return this.#http.post<CreatedDto>(`${this.#base}/business-locations`, dto);
  }

  createSector(dto: CreateSectorDto): Observable<CreatedDto> {
    return this.#http.post<CreatedDto>(`${this.#base}/sectors`, dto);
  }

  // El backend no devuelve el id de la mesa.
  createTable(dto: CreateTableDto): Observable<void> {
    return this.#http.post<void>(`${this.#base}/tables`, dto);
  }

  createProduct(dto: CreateProductDto): Observable<CreatedDto> {
    return this.#http.post<CreatedDto>(`${this.#base}/products`, dto);
  }
}
