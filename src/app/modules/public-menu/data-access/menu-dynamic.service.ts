import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  MenuDailySpecialDto,
  MenuDynamicSettingsDto,
  MenuDynamicSettingsViewDto,
  MenuMomentDto,
  MenuSeasonDto,
  MenuSuggestionRuleDto,
  SaveMenuDailySpecialDto,
  SaveMenuMomentDto,
  SaveMenuSeasonDto,
  SaveMenuSuggestionRuleDto,
} from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/menu-dynamic`;

/**
 * Etapa 11: carta dinámica. Errores: MENU_DYNAMIC_INVALID (details.field), MENU_MOMENT_OVERLAP,
 * MENU_DAILY_SPECIAL_OVERLAP, MENU_WEATHER_NO_LOCATION, PLAN_FEATURE_NOT_INCLUDED.
 */
@Injectable({ providedIn: 'root' })
export class MenuDynamicService {
  readonly #http = inject(HttpClient);

  getMoments(locationId: number): Observable<MenuMomentDto[]> {
    return this.#http.get<MenuMomentDto[]>(`${BASE}/moments`, { params: toHttpParams({ locationId }) });
  }
  createMoment(dto: SaveMenuMomentDto & { locationId: number }): Observable<MenuMomentDto> {
    return this.#http.post<MenuMomentDto>(`${BASE}/moments`, dto);
  }
  updateMoment(id: number, dto: SaveMenuMomentDto): Observable<MenuMomentDto> {
    return this.#http.patch<MenuMomentDto>(`${BASE}/moments/${id}`, dto);
  }
  deleteMoment(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/moments/${id}`);
  }
  /** Devuelve los momentos ya ordenados. */
  reorderMoments(locationId: number, ids: number[]): Observable<MenuMomentDto[]> {
    return this.#http.patch<MenuMomentDto[]>(`${BASE}/moments/reorder`, { locationId, ids });
  }

  getSeasons(locationId?: number | null): Observable<MenuSeasonDto[]> {
    return this.#http.get<MenuSeasonDto[]>(`${BASE}/seasons`, { params: toHttpParams({ locationId }) });
  }
  createSeason(dto: SaveMenuSeasonDto): Observable<MenuSeasonDto> {
    return this.#http.post<MenuSeasonDto>(`${BASE}/seasons`, dto);
  }
  updateSeason(id: number, dto: SaveMenuSeasonDto): Observable<MenuSeasonDto> {
    return this.#http.patch<MenuSeasonDto>(`${BASE}/seasons/${id}`, dto);
  }
  deleteSeason(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/seasons/${id}`);
  }

  /** from/to: YYYY-MM-DD en la zona horaria del negocio (por startsAt). */
  getDailySpecials(locationId: number, from?: string, to?: string): Observable<MenuDailySpecialDto[]> {
    return this.#http.get<MenuDailySpecialDto[]>(`${BASE}/daily-specials`, { params: toHttpParams({ locationId, from, to }) });
  }
  createDailySpecial(dto: SaveMenuDailySpecialDto & { locationId: number; productId: number; startsAt: string; endsAt: string }): Observable<MenuDailySpecialDto> {
    return this.#http.post<MenuDailySpecialDto>(`${BASE}/daily-specials`, dto);
  }
  updateDailySpecial(id: number, dto: SaveMenuDailySpecialDto): Observable<MenuDailySpecialDto> {
    return this.#http.patch<MenuDailySpecialDto>(`${BASE}/daily-specials/${id}`, dto);
  }
  deleteDailySpecial(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/daily-specials/${id}`);
  }

  getSuggestionRules(locationId?: number | null): Observable<MenuSuggestionRuleDto[]> {
    return this.#http.get<MenuSuggestionRuleDto[]>(`${BASE}/suggestion-rules`, { params: toHttpParams({ locationId }) });
  }
  createSuggestionRule(dto: SaveMenuSuggestionRuleDto): Observable<MenuSuggestionRuleDto> {
    return this.#http.post<MenuSuggestionRuleDto>(`${BASE}/suggestion-rules`, dto);
  }
  updateSuggestionRule(id: number, dto: SaveMenuSuggestionRuleDto): Observable<MenuSuggestionRuleDto> {
    return this.#http.patch<MenuSuggestionRuleDto>(`${BASE}/suggestion-rules/${id}`, dto);
  }
  deleteSuggestionRule(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/suggestion-rules/${id}`);
  }
  /** Devuelve las reglas ya ordenadas. */
  reorderSuggestionRules(locationId: number | null, ids: number[]): Observable<MenuSuggestionRuleDto[]> {
    return this.#http.patch<MenuSuggestionRuleDto[]>(`${BASE}/suggestion-rules/reorder`, { locationId, ids });
  }

  getDynamicSettings(locationId: number): Observable<MenuDynamicSettingsViewDto> {
    return this.#http.get<MenuDynamicSettingsViewDto>(`${ApiPathEnum.RESTAURANT}/menu-settings/${locationId}/dynamic`);
  }
  /** Una regla de clima enviada reemplaza la anterior; null la borra. */
  updateDynamicSettings(locationId: number, dto: Partial<MenuDynamicSettingsDto>): Observable<MenuDynamicSettingsViewDto> {
    return this.#http.patch<MenuDynamicSettingsViewDto>(`${ApiPathEnum.RESTAURANT}/menu-settings/${locationId}/dynamic`, dto);
  }
}
