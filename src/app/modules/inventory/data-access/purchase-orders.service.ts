import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderDto,
  PurchaseOrderFiltersDto,
  PurchaseOrderListItemDto,
  PurchaseOrderStatusChange,
  ReceivePurchaseOrderDto,
  SavePurchaseOrderDto,
} from './dtos';
import { toHttpParams } from './inventory.service';

const BASE = `${ApiPathEnum.RESTAURANT}/inventory/purchase-orders`;

/** Órdenes de compra: no mueven stock; recibir crea una compra vinculada a la orden. Todas devuelven el detalle. */
@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  readonly #http = inject(HttpClient);

  list(filters: PurchaseOrderFiltersDto): Observable<StandardizedPagination<PurchaseOrderListItemDto>> {
    return this.#http.get<StandardizedPagination<PurchaseOrderListItemDto>>(BASE, { params: toHttpParams(filters) });
  }

  get(id: number): Observable<PurchaseOrderDto> {
    return this.#http.get<PurchaseOrderDto>(`${BASE}/${id}`);
  }

  create(dto: CreatePurchaseOrderDto): Observable<PurchaseOrderDto> {
    return this.#http.post<PurchaseOrderDto>(BASE, dto);
  }

  /** Solo draft/sent; reemplaza cabecera y líneas. */
  update(id: number, dto: SavePurchaseOrderDto): Observable<PurchaseOrderDto> {
    return this.#http.put<PurchaseOrderDto>(`${BASE}/${id}`, dto);
  }

  /** draft ↔ sent, draft/sent/partial → cancelled (anular una parcial cierra lo pendiente). */
  changeStatus(id: number, status: PurchaseOrderStatusChange): Observable<PurchaseOrderDto> {
    return this.#http.patch<PurchaseOrderDto>(`${BASE}/${id}/status`, { status });
  }

  receive(id: number, dto: ReceivePurchaseOrderDto): Observable<PurchaseOrderDto> {
    return this.#http.post<PurchaseOrderDto>(`${BASE}/${id}/receive`, dto);
  }
}
