import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import {
  CreateAdjustmentDto,
  CreatePurchaseDto,
  InventoryDocumentDto,
  InventoryDocumentFiltersDto,
  InventoryDocumentResultDto,
  StockFiltersDto,
  StockItemDto,
  StockMovementDto,
  StockMovementFiltersDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/inventory`;

/** Arma los query params omitiendo vacíos (undefined, null, ''). */
export function toHttpParams(filters: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/** Endpoints de inventario. Si el inventario está apagado responden 409 (ver isInventoryDisabledError). */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  readonly #http = inject(HttpClient);

  getStock(filters: StockFiltersDto): Observable<StandardizedPagination<StockItemDto>> {
    return this.#http.get<StandardizedPagination<StockItemDto>>(`${BASE}/stock`, { params: toHttpParams(filters) });
  }

  /** Cantidad de ítems bajo el mínimo en un local (para el widget de alertas). */
  countLowStock(locationId: number): Observable<StandardizedPagination<StockItemDto>> {
    return this.getStock({ locationId, lowStock: true, page: 1, perPage: 1 });
  }

  getMovements(filters: StockMovementFiltersDto): Observable<StandardizedPagination<StockMovementDto>> {
    return this.#http.get<StandardizedPagination<StockMovementDto>>(`${BASE}/movements`, {
      params: toHttpParams(filters),
    });
  }

  getDocuments(filters: InventoryDocumentFiltersDto): Observable<StandardizedPagination<InventoryDocumentDto>> {
    return this.#http.get<StandardizedPagination<InventoryDocumentDto>>(`${BASE}/documents`, {
      params: toHttpParams(filters),
    });
  }

  createPurchase(dto: CreatePurchaseDto): Observable<InventoryDocumentResultDto> {
    return this.#http.post<InventoryDocumentResultDto>(`${BASE}/purchases`, dto);
  }

  createAdjustment(dto: CreateAdjustmentDto): Observable<InventoryDocumentResultDto> {
    return this.#http.post<InventoryDocumentResultDto>(`${BASE}/adjustments`, dto);
  }
}
