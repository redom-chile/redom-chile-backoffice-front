import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import { ApiPathEnum } from 'src/environments';
import {
  HelpArticleDto,
  HelpArticleFiltersDto,
  HelpArticleItemDto,
  HelpCategoryDto,
  HelpVoteDto,
  HelpVoteRequestDto,
} from './dtos';

export const HELP_BASE = `${ApiPathEnum.RESTAURANT}/help`;

/** Centro de ayuda: solo artículos publicados de categorías activas (contenido global de Redom). */
@Injectable({ providedIn: 'root' })
export class HelpService {
  readonly #http = inject(HttpClient);

  getCategories(): Observable<HelpCategoryDto[]> {
    return this.#http.get<HelpCategoryDto[]>(`${HELP_BASE}/categories`);
  }

  getArticles(filters: HelpArticleFiltersDto): Observable<StandardizedPagination<HelpArticleItemDto>> {
    return this.#http.get<StandardizedPagination<HelpArticleItemDto>>(`${HELP_BASE}/articles`, { params: toHttpParams(filters) });
  }

  /** 404 HELP_ARTICLE_NOT_FOUND si no existe o no está publicado. */
  getArticle(slug: string): Observable<HelpArticleDto> {
    return this.#http.get<HelpArticleDto>(`${HELP_BASE}/articles/${encodeURIComponent(slug)}`);
  }

  /** Un voto por usuario y artículo: votar de nuevo lo reemplaza. */
  voteArticle(id: number, dto: HelpVoteRequestDto): Observable<HelpVoteDto> {
    return this.#http.post<HelpVoteDto>(`${HELP_BASE}/articles/${id}/feedback`, dto);
  }

  /** 👍/👎 de una respuesta del asistente (solo quien preguntó). */
  voteAnswer(logId: number, dto: HelpVoteRequestDto): Observable<void> {
    return this.#http.post<void>(`${HELP_BASE}/chat/${logId}/feedback`, dto);
  }
}
