import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  AiInsightDto,
  AiOverviewDto,
  AiSettingsDto,
  ApplyDescriptionsDto,
  DescriptionSuggestionsDto,
  RequestDescriptionsDto,
  TagSuggestionsDto,
  UpdateAiSettingsDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/menu-ai`;

/**
 * Etapa 9: la IA sugiere y el dueño aplica. Errores: AI_CONTENT_DISABLED (409, details.setting), AI_CONTENT_QUOTA_EXCEEDED (429),
 * AI_CONTENT_UNAVAILABLE (503), AI_INSIGHTS_RATE_LIMITED (429), AI_SETTINGS_INVALID (400).
 */
@Injectable({ providedIn: 'root' })
export class MenuAiService {
  readonly #http = inject(HttpClient);

  getSettings(): Observable<AiSettingsDto> {
    return this.#http.get<AiSettingsDto>(`${BASE}/settings`);
  }

  updateSettings(dto: UpdateAiSettingsDto): Observable<AiSettingsDto> {
    return this.#http.patch<AiSettingsDto>(`${BASE}/settings`, dto);
  }

  /**
   * Hasta 20 productos o scope 'missing' (de a 20). Cuenta 1 cada producto con opciones; si la cuota no alcanza,
   * el servidor procesa solo los que caben.
   */
  suggestDescriptions(dto: RequestDescriptionsDto): Observable<DescriptionSuggestionsDto> {
    return this.#http.post<DescriptionSuggestionsDto>(`${BASE}/descriptions`, dto);
  }

  /** Hasta 50. */
  applyDescriptions(dto: ApplyDescriptionsDto): Observable<{ count: number }> {
    return this.#http.post<{ count: number }>(`${BASE}/descriptions/apply`, dto);
  }

  /** Solo productos con receta (tope diario: 429 con details.period 'day'). Se aplican con PUT /products/{id}/tags (ids). */
  suggestTags(dto: { productIds?: number[]; scope?: 'missing' }): Observable<TagSuggestionsDto> {
    return this.#http.post<TagSuggestionsDto>(`${BASE}/tags`, dto);
  }

  getOverview(locationId?: number | null): Observable<AiOverviewDto> {
    return this.#http.get<AiOverviewDto>(`${BASE}/overview`, { params: toHttpParams({ locationId }) });
  }

  getInsights(locationId?: number | null): Observable<AiInsightDto[]> {
    return this.#http.get<AiInsightDto[]>(`${BASE}/insights`, { params: toHttpParams({ locationId }) });
  }

  /** Máximo 1 al día (429 AI_INSIGHTS_RATE_LIMITED con details.nextAt). */
  refreshInsights(locationId?: number | null): Observable<AiInsightDto[]> {
    return this.#http.post<AiInsightDto[]>(`${BASE}/insights/refresh`, { locationId: locationId ?? undefined });
  }

  dismissInsight(id: number): Observable<void> {
    return this.#http.post<void>(`${BASE}/insights/${id}/dismiss`, {});
  }

  /** Detalle del producto (precio, variedades y etiquetas por código). */
  getProduct(id: number): Observable<ProductDto> {
    return this.#http.get<ProductDto>(`${ApiPathEnum.RESTAURANT}/products/${id}`);
  }

  /** Productos para elegir (sin sets de modificadores). */
  searchProducts(params: { page: number; perPage: number; name?: string }): Observable<StandardizedPagination<ProductDto>> {
    return this.#http
      .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params: toHttpParams(params) })
      .pipe(map((page) => ({ ...page, data: page.data.filter((product) => product.type !== 'modifier') })));
  }
}
