import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import {
  AutomationDto,
  AutomationType,
  CampaignAudienceDto,
  CampaignDto,
  MessagingLocation,
  PreviewDto,
  SaveCampaignDto,
  TestResultDto,
  UpdateAutomationDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/messaging`;

/** Mensajería (plan customerMessaging; permisos messaging:see-module / manage-automations / send-campaigns). */
@Injectable({ providedIn: 'root' })
export class MessagingService {
  readonly #http = inject(HttpClient);

  getAutomations(): Observable<AutomationDto[]> {
    return this.#http.get<AutomationDto[]>(`${BASE}/automations`);
  }

  updateAutomation(type: AutomationType, dto: UpdateAutomationDto): Observable<AutomationDto> {
    return this.#http.patch<AutomationDto>(`${BASE}/automations/${type}`, dto);
  }

  previewAutomation(type: AutomationType): Observable<PreviewDto> {
    return this.#http.get<PreviewDto>(`${BASE}/automations/${type}/preview`);
  }

  testAutomation(type: AutomationType, email?: string): Observable<TestResultDto> {
    return this.#http.post<TestResultDto>(`${BASE}/automations/${type}/test`, email ? { email } : {});
  }

  getCampaigns(): Observable<CampaignDto[]> {
    return this.#http.get<CampaignDto[]>(`${BASE}/campaigns`);
  }

  /** No hay GET por id: se busca en la lista (404 si no está). */
  getCampaign(id: number): Observable<CampaignDto | null> {
    return this.getCampaigns().pipe(map((list) => list.find((item) => item.id === id) ?? null));
  }

  createCampaign(dto: SaveCampaignDto): Observable<CampaignDto> {
    return this.#http.post<CampaignDto>(`${BASE}/campaigns`, dto);
  }

  updateCampaign(id: number, dto: SaveCampaignDto): Observable<CampaignDto> {
    return this.#http.patch<CampaignDto>(`${BASE}/campaigns/${id}`, dto);
  }

  deleteCampaign(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/campaigns/${id}`);
  }

  getAudience(id: number): Observable<CampaignAudienceDto> {
    return this.#http.get<CampaignAudienceDto>(`${BASE}/campaigns/${id}/audience`);
  }

  previewCampaign(id: number): Observable<PreviewDto> {
    return this.#http.get<PreviewDto>(`${BASE}/campaigns/${id}/preview`);
  }

  testCampaign(id: number, email?: string): Observable<TestResultDto> {
    return this.#http.post<TestResultDto>(`${BASE}/campaigns/${id}/test`, email ? { email } : {});
  }

  /** Sin fecha: ahora. 400 MESSAGING_AUDIENCE_EMPTY; 409 MESSAGING_QUOTA_EXCEEDED. */
  sendCampaign(id: number, scheduledAt?: string): Observable<CampaignDto> {
    return this.#http.post<CampaignDto>(`${BASE}/campaigns/${id}/send`, scheduledAt ? { scheduledAt } : {});
  }

  cancelCampaign(id: number): Observable<CampaignDto> {
    return this.#http.post<CampaignDto>(`${BASE}/campaigns/${id}/cancel`, {});
  }

  getLocations(): Observable<MessagingLocation[]> {
    return this.#http
      .get<Array<{ id: number; name: string }>>(`${ApiPathEnum.RESTAURANT}/business-locations`)
      .pipe(map((list) => list.map(({ id, name }) => ({ id, name }))));
  }
}
