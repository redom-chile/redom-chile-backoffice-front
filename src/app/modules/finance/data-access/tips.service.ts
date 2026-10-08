import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CreateTipPayoutDto,
  PendingTipsDto,
  TipDistributionDto,
  TipDistributionRequestDto,
  TipPayoutDto,
  TipPayoutFiltersDto,
  TipPayoutListItemDto,
  TipsPeriodFiltersDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/tips`;

/** Propinas pendientes y sus liquidaciones al equipo. */
@Injectable({ providedIn: 'root' })
export class TipsService {
  readonly #http = inject(HttpClient);

  pending(filters: TipsPeriodFiltersDto = {}): Observable<PendingTipsDto> {
    return this.#http.get<PendingTipsDto>(`${BASE}/pending`, { params: toHttpParams(filters) });
  }

  /** No guarda nada. */
  preview(dto: TipDistributionRequestDto): Observable<TipDistributionDto> {
    return this.#http.post<TipDistributionDto>(`${BASE}/payouts/preview`, dto);
  }

  /** 409 NO_TIPS_TO_PAY si no hay pendientes; en efectivo con la caja activa sale de la caja. */
  createPayout(dto: CreateTipPayoutDto): Observable<TipPayoutDto> {
    return this.#http.post<TipPayoutDto>(`${BASE}/payouts`, dto);
  }

  payouts(filters: TipPayoutFiltersDto): Observable<StandardizedPagination<TipPayoutListItemDto>> {
    return this.#http.get<StandardizedPagination<TipPayoutListItemDto>>(`${BASE}/payouts`, { params: toHttpParams(filters) });
  }

  payout(id: number): Observable<TipPayoutDto> {
    return this.#http.get<TipPayoutDto>(`${BASE}/payouts/${id}`);
  }

  /** Las propinas vuelven a pendientes; el efectivo vuelve a la caja abierta (409 CASH_SESSION_REQUIRED si está cerrada). */
  cancelPayout(id: number, reason: string): Observable<TipPayoutDto> {
    return this.#http.patch<TipPayoutDto>(`${BASE}/payouts/${id}/cancel`, { reason });
  }
}
