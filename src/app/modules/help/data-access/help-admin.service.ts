import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { toHttpParams } from 'src/app/modules/inventory/data-access';
import {
  HelpAdminArticleDto,
  HelpAdminArticleFiltersDto,
  HelpAdminArticleItemDto,
  HelpAdminCategoryDto,
  HelpArticleVoteDto,
  HelpChatLogDto,
  HelpChatLogFiltersDto,
  HelpUsageDto,
  SaveHelpArticleDto,
  SaveHelpCategoryDto,
} from './dtos';
import { HELP_BASE } from './help.service';

const ADMIN = `${HELP_BASE}/admin`;

/** Administración del centro de ayuda: solo SUPERADMIN (el resto recibe 403). */
@Injectable({ providedIn: 'root' })
export class HelpAdminService {
  readonly #http = inject(HttpClient);

  // --- Categorías ---
  getCategories(includeInactive = true): Observable<HelpAdminCategoryDto[]> {
    return this.#http.get<HelpAdminCategoryDto[]>(`${ADMIN}/categories`, { params: toHttpParams({ includeInactive }) });
  }

  /** 409 HELP_SLUG_TAKEN si el slug enviado ya existe. */
  createCategory(dto: SaveHelpCategoryDto): Observable<{ id: number }> {
    return this.#http.post<{ id: number }>(`${ADMIN}/categories`, dto);
  }

  updateCategory(id: number, dto: SaveHelpCategoryDto): Observable<HelpAdminCategoryDto> {
    return this.#http.put<HelpAdminCategoryDto>(`${ADMIN}/categories/${id}`, dto);
  }

  /** 409 HELP_CATEGORY_NOT_EMPTY si tiene artículos: ofrecer desactivarla. */
  deleteCategory(id: number): Observable<void> {
    return this.#http.delete<void>(`${ADMIN}/categories/${id}`);
  }

  /** `position` = índice en `ids`. */
  reorderCategories(ids: number[]): Observable<void> {
    return this.#http.patch<void>(`${ADMIN}/categories/reorder`, { ids });
  }

  // --- Artículos ---
  getArticles(filters: HelpAdminArticleFiltersDto): Observable<StandardizedPagination<HelpAdminArticleItemDto>> {
    return this.#http.get<StandardizedPagination<HelpAdminArticleItemDto>>(`${ADMIN}/articles`, { params: toHttpParams(filters) });
  }

  getArticle(id: number): Observable<HelpAdminArticleDto> {
    return this.#http.get<HelpAdminArticleDto>(`${ADMIN}/articles/${id}`);
  }

  createArticle(dto: SaveHelpArticleDto): Observable<HelpAdminArticleDto> {
    return this.#http.post<HelpAdminArticleDto>(`${ADMIN}/articles`, dto);
  }

  updateArticle(id: number, dto: SaveHelpArticleDto): Observable<HelpAdminArticleDto> {
    return this.#http.put<HelpAdminArticleDto>(`${ADMIN}/articles/${id}`, dto);
  }

  publishArticle(id: number, isPublished: boolean): Observable<HelpAdminArticleDto> {
    return this.#http.patch<HelpAdminArticleDto>(`${ADMIN}/articles/${id}/publish`, { isPublished });
  }

  /** Copia en borrador (`slug-copia`, título con "(copia)"). */
  duplicateArticle(id: number): Observable<HelpAdminArticleDto> {
    return this.#http.post<HelpAdminArticleDto>(`${ADMIN}/articles/${id}/duplicate`, {});
  }

  /** Borra también sus votos. */
  deleteArticle(id: number): Observable<void> {
    return this.#http.delete<void>(`${ADMIN}/articles/${id}`);
  }

  /** Orden dentro de una categoría. */
  reorderArticles(categoryId: number, ids: number[]): Observable<void> {
    return this.#http.patch<void>(`${ADMIN}/articles/reorder`, { categoryId, ids });
  }

  getArticleFeedback(id: number, page = 1, perPage = 20): Observable<StandardizedPagination<HelpArticleVoteDto>> {
    return this.#http.get<StandardizedPagination<HelpArticleVoteDto>>(`${ADMIN}/articles/${id}/feedback`, {
      params: toHttpParams({ page, perPage }),
    });
  }

  // --- Revisión y uso del asistente ---
  getChatLogs(filters: HelpChatLogFiltersDto): Observable<StandardizedPagination<HelpChatLogDto>> {
    return this.#http.get<StandardizedPagination<HelpChatLogDto>>(`${ADMIN}/chat-logs`, { params: toHttpParams(filters) });
  }

  getUsage(range: { from?: string; to?: string } = {}): Observable<HelpUsageDto> {
    return this.#http.get<HelpUsageDto>(`${ADMIN}/usage`, { params: toHttpParams(range) });
  }
}
