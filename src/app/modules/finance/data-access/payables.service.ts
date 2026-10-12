import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CancelPayablePaymentResultDto,
  CreatePayablePaymentDto,
  PayableFiltersDto,
  PayablePaymentDto,
  PayablePaymentResultDto,
  PayablesDto,
  PayableType,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/payables`;

/** Deudas abiertas (gastos y compras) y sus pagos. El efectivo con la caja activa sale del turno abierto. */
@Injectable({ providedIn: 'root' })
export class PayablesService {
  readonly #http = inject(HttpClient);

  list(filters: PayableFiltersDto = {}): Observable<PayablesDto> {
    return this.#http.get<PayablesDto>(BASE, { params: toHttpParams(filters) });
  }

  pay(type: PayableType, id: number, dto: CreatePayablePaymentDto): Observable<PayablePaymentResultDto> {
    return this.#http.post<PayablePaymentResultDto>(`${BASE}/${type}/${id}/payments`, dto);
  }

  payments(type: PayableType, id: number): Observable<PayablePaymentDto[]> {
    return this.#http.get<PayablePaymentDto[]>(`${BASE}/${type}/${id}/payments`);
  }

  /** El efectivo vuelve a la caja abierta; 409 CASH_SESSION_REQUIRED si la caja de origen está cerrada. */
  cancelPayment(paymentId: number, reason: string): Observable<CancelPayablePaymentResultDto> {
    return this.#http.patch<CancelPayablePaymentResultDto>(`${BASE}/payments/${paymentId}/cancel`, { reason });
  }
}
