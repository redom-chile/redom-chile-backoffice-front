import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  CashMovementResultDto,
  CashRegisterDto,
  CashRegisterFiltersDto,
  CashSessionDto,
  CashSessionFiltersDto,
  CashSessionListItemDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  CreateCashRegisterDto,
  CurrentCashSessionDto,
  OpenCashSessionDto,
  UpdateCashRegisterDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/cash`;

/** Caja y turnos. Con el módulo apagado, abrir, turno actual, movimientos y cierre responden 409 CASH_MANAGEMENT_DISABLED. */
@Injectable({ providedIn: 'root' })
export class CashService {
  readonly #http = inject(HttpClient);

  /** Funciona aunque el módulo esté apagado (para dejarlas listas). Sin paginar. */
  getRegisters(filters: CashRegisterFiltersDto = {}): Observable<CashRegisterDto[]> {
    return this.#http.get<CashRegisterDto[]>(`${BASE}/registers`, { params: toHttpParams(filters) });
  }

  createRegister(dto: CreateCashRegisterDto): Observable<{ id: number }> {
    return this.#http.post<{ id: number }>(`${BASE}/registers`, dto);
  }

  updateRegister(id: number, dto: UpdateCashRegisterDto): Observable<void> {
    return this.#http.put<void>(`${BASE}/registers/${id}`, dto);
  }

  openSession(dto: OpenCashSessionDto): Observable<CashSessionDto> {
    return this.#http.post<CashSessionDto>(`${BASE}/sessions`, dto);
  }

  getCurrentSession(registerId: number): Observable<CurrentCashSessionDto> {
    return this.#http.get<CurrentCashSessionDto>(`${BASE}/sessions/current`, { params: toHttpParams({ registerId }) });
  }

  addMovement(sessionId: number, dto: CreateCashMovementDto): Observable<CashMovementResultDto> {
    return this.#http.post<CashMovementResultDto>(`${BASE}/sessions/${sessionId}/movements`, dto);
  }

  /** Devuelve el reporte Z. */
  closeSession(sessionId: number, dto: CloseCashSessionDto): Observable<CashSessionDto> {
    return this.#http.post<CashSessionDto>(`${BASE}/sessions/${sessionId}/close`, dto);
  }

  getSessions(filters: CashSessionFiltersDto): Observable<StandardizedPagination<CashSessionListItemDto>> {
    return this.#http.get<StandardizedPagination<CashSessionListItemDto>>(`${BASE}/sessions`, {
      params: toHttpParams(filters),
    });
  }

  getSession(id: number): Observable<CashSessionDto> {
    return this.#http.get<CashSessionDto>(`${BASE}/sessions/${id}`);
  }
}
