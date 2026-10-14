import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import { CustomerOrderDto, CustomerOrderStatus } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/customer-orders`;

/** Pedidos de clientes desde la mesa (plan table_ordering; permisos customer-orders:see-module / manage). */
@Injectable({ providedIn: 'root' })
export class CustomerOrdersService {
  readonly #http = inject(HttpClient);

  /** Pendientes por defecto (el más antiguo primero); con varios estados, el historial (el más nuevo primero). */
  list(filters: { locationId?: number; status?: CustomerOrderStatus[]; limit?: number } = {}): Observable<CustomerOrderDto[]> {
    const { status, ...rest } = filters;
    return this.#http.get<CustomerOrderDto[]>(BASE, { params: toHttpParams({ ...rest, status: status?.join(',') }) });
  }

  get(id: string): Observable<CustomerOrderDto> {
    return this.#http.get<CustomerOrderDto>(`${BASE}/${id}`);
  }

  /** Agrega a la venta abierta de la mesa (o abre una), con los precios del momento. 409 CUSTOMER_ORDER_NOT_PENDING / TABLE_BLOCKED. */
  accept(id: string): Observable<CustomerOrderDto> {
    return this.#http.post<CustomerOrderDto>(`${BASE}/${id}/accept`, {});
  }

  /** reason: 1 a 300. */
  reject(id: string, reason: string): Observable<CustomerOrderDto> {
    return this.#http.post<CustomerOrderDto>(`${BASE}/${id}/reject`, { reason });
  }
}
