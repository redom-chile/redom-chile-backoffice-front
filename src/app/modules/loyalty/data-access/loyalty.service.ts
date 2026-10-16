import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  LoyaltyCustomerDto,
  LoyaltyProgramDto,
  LoyaltyRedeemResultDto,
  LoyaltyRewardDto,
  SaveLoyaltyProgramDto,
  SaveLoyaltyRewardDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/loyalty`;

/** Fidelización (plan loyalty; permisos loyalty:see-module / manage / redeem). */
@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  readonly #http = inject(HttpClient);

  /** null: aún no se crea. */
  getProgram(): Observable<LoyaltyProgramDto | null> {
    return this.#http.get<LoyaltyProgramDto | null>(`${BASE}/program`);
  }

  /** 400 si faltan datos de la mecánica. */
  saveProgram(dto: SaveLoyaltyProgramDto): Observable<LoyaltyProgramDto> {
    return this.#http.put<LoyaltyProgramDto>(`${BASE}/program`, dto);
  }

  getRewards(): Observable<LoyaltyRewardDto[]> {
    return this.#http.get<LoyaltyRewardDto[]>(`${BASE}/rewards`);
  }

  createReward(dto: SaveLoyaltyRewardDto): Observable<LoyaltyRewardDto> {
    return this.#http.post<LoyaltyRewardDto>(`${BASE}/rewards`, dto);
  }

  updateReward(id: number, dto: SaveLoyaltyRewardDto): Observable<LoyaltyRewardDto> {
    return this.#http.patch<LoyaltyRewardDto>(`${BASE}/rewards/${id}`, dto);
  }

  deleteReward(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/rewards/${id}`);
  }

  /** Por teléfono (últimos 8 dígitos) o contactId. 404 si no es cliente del negocio. */
  getCustomer(query: { phone?: string; contactId?: number }): Observable<LoyaltyCustomerDto> {
    return this.#http.get<LoyaltyCustomerDto>(`${BASE}/customer`, { params: toHttpParams(query) });
  }

  /** amount ±. 409 LOYALTY_INSUFFICIENT_BALANCE. */
  adjust(dto: { contactId: number; amount: number; note: string }): Observable<LoyaltyCustomerDto> {
    return this.#http.post<LoyaltyCustomerDto>(`${BASE}/adjust`, dto);
  }

  /** Luego recargar la venta (GET /orders/{id}). Errores 409 LOYALTY_*, ORDER_NOT_OPEN. */
  redeem(dto: { transactionId: number; rewardId: number }): Observable<LoyaltyRedeemResultDto> {
    return this.#http.post<LoyaltyRedeemResultDto>(`${BASE}/redeem`, dto);
  }
}
