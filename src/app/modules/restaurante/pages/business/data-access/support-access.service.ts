import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import { SupportAccessDays, SupportAccessStateDto, SupportEventDto, SupportGrantDto } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/support-access`;

/** Solo el dueño del negocio; los demás reciben 403 SUPPORT_ACCESS_OWNER_REQUIRED. */
@Injectable({ providedIn: 'root' })
export class SupportAccessService {
  readonly #http = inject(HttpClient);

  getState(): Observable<SupportAccessStateDto> {
    return this.#http.get<SupportAccessStateDto>(BASE);
  }

  /** Crea, o extiende el vigente (mismo id, suma desde hoy). 400 SUPPORT_ACCESS_INVALID_DAYS. */
  grant(dto: { days?: SupportAccessDays; note?: string }): Observable<SupportGrantDto> {
    return this.#http.post<SupportGrantDto>(BASE, dto);
  }

  /** 404 SUPPORT_ACCESS_NOT_FOUND si no hay vigente. */
  revoke(): Observable<void> {
    return this.#http.delete<void>(BASE);
  }

  getEvents(filters: { grantId?: number; page?: number; perPage?: number }): Observable<StandardizedPagination<SupportEventDto>> {
    return this.#http.get<StandardizedPagination<SupportEventDto>>(`${BASE}/events`, { params: toHttpParams(filters) });
  }
}
