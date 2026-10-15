import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import { AiTranslationResultDto, AiTranslationScope, ExtraMenuLanguage, MenuTranslationsPageDto, MenuTranslationsQuery, SaveMenuTranslationsDto } from './dtos';

const BASE = `${ApiPathEnum.RESTAURANT}/menu-translations`;

/** Traducciones de la carta (plan menu_translations; IA: menu_ai_translations). */
@Injectable({ providedIn: 'root' })
export class MenuTranslationsService {
  readonly #http = inject(HttpClient);

  getPage(query: MenuTranslationsQuery): Observable<MenuTranslationsPageDto> {
    return this.#http.get<MenuTranslationsPageDto>(BASE, { params: toHttpParams(query) });
  }

  /** Sin status: publicadas. */
  save(dto: SaveMenuTranslationsDto): Observable<{ count: number }> {
    return this.#http.put<{ count: number }>(BASE, dto);
  }

  /** Publica los borradores del idioma. */
  publish(language: ExtraMenuLanguage): Observable<{ count: number }> {
    return this.#http.post<{ count: number }>(`${BASE}/publish`, { language });
  }

  delete(id: number): Observable<void> {
    return this.#http.delete<void>(`${BASE}/${id}`);
  }

  /** Deja borradores. 429 AI_TRANSLATIONS_QUOTA_EXCEEDED, 503 AI_TRANSLATIONS_UNAVAILABLE. */
  translateWithAi(language: ExtraMenuLanguage, scope?: AiTranslationScope): Observable<AiTranslationResultDto> {
    return this.#http.post<AiTranslationResultDto>(`${BASE}/ai`, { language, scope });
  }
}
