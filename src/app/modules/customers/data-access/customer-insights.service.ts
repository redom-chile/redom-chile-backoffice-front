import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import {
  CustomerInsightDetailDto,
  CustomerInsightsFilters,
  CustomerInsightsPageDto,
  CustomerInsightsSummaryDto,
  SegmentSettingsDto,
  SegmentSettingsResponseDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/customers`;

function filtersToParams(filters: CustomerInsightsFilters): HttpParams {
  let params = new HttpParams();
  if (filters.segment) params = params.set('segment', filters.segment);
  if (filters.q?.trim()) params = params.set('q', filters.q.trim());
  if (filters.locationId) params = params.set('locationId', filters.locationId);
  if (filters.marketingConsent !== null && filters.marketingConsent !== undefined) params = params.set('marketingConsent', String(filters.marketingConsent));
  if (filters.page) params = params.set('page', filters.page);
  if (filters.limit) params = params.set('limit', filters.limit);
  if (filters.sort) params = params.set('sort', filters.sort);
  return params;
}

/** Panel de clientes (función del plan customerInsights). */
@Injectable({ providedIn: 'root' })
export class CustomerInsightsService {
  readonly #http = inject(HttpClient);

  list(filters: CustomerInsightsFilters): Observable<CustomerInsightsPageDto> {
    return this.#http.get<CustomerInsightsPageDto>(`${BASE}/insights`, { params: filtersToParams(filters) });
  }

  summary(locationId: number | null): Observable<CustomerInsightsSummaryDto> {
    return this.#http.get<CustomerInsightsSummaryDto>(`${BASE}/insights/summary`, { params: filtersToParams({ locationId }) });
  }

  /** CSV con los mismos filtros de la lista (sin página ni orden). */
  exportCsv(filters: CustomerInsightsFilters): Observable<HttpResponse<Blob>> {
    const { page: _page, limit: _limit, sort: _sort, ...rest } = filters;
    return this.#http.get(`${BASE}/insights/export`, {
      params: filtersToParams(rest).set('format', 'csv'),
      responseType: 'blob',
      observe: 'response',
    });
  }

  detail(contactId: number): Observable<CustomerInsightDetailDto> {
    return this.#http.get<CustomerInsightDetailDto>(`${BASE}/${contactId}/insights`);
  }

  getSegmentSettings(): Observable<SegmentSettingsResponseDto> {
    return this.#http.get<SegmentSettingsResponseDto>(`${BASE}/segments-settings`);
  }

  /** Recalcula los segmentos al tiro. */
  updateSegmentSettings(changes: Partial<SegmentSettingsDto>): Observable<SegmentSettingsResponseDto> {
    return this.#http.patch<SegmentSettingsResponseDto>(`${BASE}/segments-settings`, changes);
  }
}
