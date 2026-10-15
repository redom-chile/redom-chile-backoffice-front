import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  ApiKeyDto,
  CreateApiKeyDto,
  CreatedApiKeyDto,
  SaveWebhookEndpointDto,
  WebhookDeliveryDto,
  WebhookDeliveryResultDto,
  WebhookEndpointDto,
  WebhookEndpointWithSecretDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/public-api`;

/** Swagger público para los desarrolladores de los negocios. */
export const PUBLIC_API_DOCS_URL = `${ApiPathEnum.RESTAURANT}/public/docs`;

/** Llaves y webhooks de la API pública (plan public_api; permisos public-api:see-module / manage). */
@Injectable({ providedIn: 'root' })
export class PublicApiService {
  readonly #http = inject(HttpClient);

  // --- Llaves (409 con más de 10 activas) ---
  getKeys(): Observable<ApiKeyDto[]> {
    return this.#http.get<ApiKeyDto[]>(`${BASE}/keys`);
  }

  createKey(dto: CreateApiKeyDto): Observable<CreatedApiKeyDto> {
    return this.#http.post<CreatedApiKeyDto>(`${BASE}/keys`, dto);
  }

  updateKey(id: number, dto: { name?: string; allowedOrigins?: string[] }): Observable<ApiKeyDto> {
    return this.#http.patch<ApiKeyDto>(`${BASE}/keys/${id}`, dto);
  }

  /** Revoca: deja de funcionar al instante. */
  revokeKey(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/keys/${id}`);
  }

  // --- Webhooks (hasta 5; 400 WEBHOOK_URL_INVALID) ---
  getWebhooks(): Observable<WebhookEndpointDto[]> {
    return this.#http.get<WebhookEndpointDto[]>(`${BASE}/webhooks`);
  }

  createWebhook(dto: SaveWebhookEndpointDto & { url: string; events: string[] }): Observable<WebhookEndpointWithSecretDto> {
    return this.#http.post<WebhookEndpointWithSecretDto>(`${BASE}/webhooks`, dto);
  }

  updateWebhook(id: number, dto: SaveWebhookEndpointDto): Observable<WebhookEndpointDto> {
    return this.#http.patch<WebhookEndpointDto>(`${BASE}/webhooks/${id}`, dto);
  }

  deleteWebhook(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/webhooks/${id}`);
  }

  rotateWebhookSecret(id: number): Observable<WebhookEndpointWithSecretDto> {
    return this.#http.post<WebhookEndpointWithSecretDto>(`${BASE}/webhooks/${id}/rotate-secret`, {});
  }

  /** Envía un ping. */
  testWebhook(id: number): Observable<WebhookDeliveryResultDto> {
    return this.#http.post<WebhookDeliveryResultDto>(`${BASE}/webhooks/${id}/test`, {});
  }

  getDeliveries(id: number, limit = 50): Observable<WebhookDeliveryDto[]> {
    return this.#http.get<WebhookDeliveryDto[]>(`${BASE}/webhooks/${id}/deliveries`, { params: toHttpParams({ limit }) });
  }

  retryDelivery(id: number, deliveryId: number): Observable<WebhookDeliveryResultDto> {
    return this.#http.post<WebhookDeliveryResultDto>(`${BASE}/webhooks/${id}/deliveries/${deliveryId}/retry`, {});
  }
}
