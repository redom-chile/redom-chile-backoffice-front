import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import {
  ConsumptionFiltersDto,
  ConsumptionReportDto,
  CountResultDto,
  CreateAdjustmentDto,
  CreateCountDto,
  CreateProductionDto,
  CreateTransferDto,
  FoodCostFiltersDto,
  FoodCostItemDto,
  CreatePurchaseDto,
  InventoryDocumentDto,
  InventoryDocumentFiltersDto,
  InventoryDocumentResultDto,
  StockFiltersDto,
  StockItemDto,
  StockMovementDto,
  StockMovementFiltersDto,
  ProductionResultDto,
  StockLotDto,
  StockLotFiltersDto,
  TransferResultDto,
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

  getFoodCost(filters: FoodCostFiltersDto = {}): Observable<FoodCostItemDto[]> {
    return this.#http.get<FoodCostItemDto[]>(`${BASE}/food-cost`, { params: toHttpParams(filters) });
  }

  createCount(dto: CreateCountDto): Observable<CountResultDto> {
    return this.#http.post<CountResultDto>(`${BASE}/counts`, dto);
  }

  createTransfer(dto: CreateTransferDto): Observable<TransferResultDto> {
    return this.#http.post<TransferResultDto>(`${BASE}/transfers`, dto);
  }

  getConsumption(filters: ConsumptionFiltersDto): Observable<ConsumptionReportDto> {
    return this.#http.get<ConsumptionReportDto>(`${BASE}/consumption`, { params: toHttpParams(filters) });
  }

  createProduction(dto: CreateProductionDto): Observable<ProductionResultDto> {
    return this.#http.post<ProductionResultDto>(`${BASE}/productions`, dto);
  }

  /** Lotes con saldo, el que vence antes primero (sin paginar). */
  getLots(filters: StockLotFiltersDto = {}): Observable<StockLotDto[]> {
    return this.#http.get<StockLotDto[]>(`${BASE}/lots`, { params: toHttpParams(filters) });
  }
}
