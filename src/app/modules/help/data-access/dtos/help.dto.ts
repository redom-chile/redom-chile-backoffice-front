/** Contrato del centro de ayuda (#46). Backend: libs/restaurant/help-center/src/lib/help-dto.ts. */

export const HELP_MODULES = ['onboarding', 'pos', 'orders', 'cash', 'products', 'inventory', 'recipes', 'finance', 'tips', 'settings'] as const;
export type HelpModule = (typeof HELP_MODULES)[number];

// --- Centro de ayuda (cualquier usuario del negocio) ---

/** `articlesCount`: solo los publicados. `icon`: nombre de un ícono Material. */
export type HelpCategoryDto = Readonly<{
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  position: number;
  articlesCount: number;
}>;

export type HelpArticleItemDto = Readonly<{
  id: number;
  slug: string;
  title: string;
  summary: string;
  categoryId: number;
  categoryName: string;
  module: HelpModule;
  routes: string[];
  updatedAt: string;
}>;

export type HelpVoteDto = Readonly<{ helpful: boolean; comment: string | null }>;

/** Artículo publicado: `body` en markdown y el voto del usuario actual. */
export type HelpArticleDto = HelpArticleItemDto &
  Readonly<{
    body: string;
    categorySlug: string;
    tags: string[];
    publishedAt: string | null;
    userFeedback: HelpVoteDto | null;
  }>;

/** `search`: todas las palabras, sin importar tildes. `route`: los de esa pantalla van primero (no filtra). */
export type HelpArticleFiltersDto = Readonly<{
  search?: string;
  categoryId?: number;
  module?: HelpModule;
  route?: string;
  page?: number;
  perPage?: number;
}>;

export type HelpVoteRequestDto = Readonly<{ helpful: boolean; comment?: string | null }>;

// --- Asistente (POST /help/chat, text/event-stream) ---

export type HelpChatMessageDto = Readonly<{ role: 'user' | 'assistant'; content: string }>;

/** `history`: máximo 6 mensajes de 2000 caracteres. */
export type HelpChatRequestDto = Readonly<{ question: string; route?: string; history?: HelpChatMessageDto[] }>;

export type HelpArticleLinkDto = Readonly<{ slug: string; title: string }>;

/**
 * Eventos del stream:
 * - `articles`: sugeridos por la búsqueda; solo son la alternativa si llega `error` (no son fuentes).
 * - `delta`: un trozo de la respuesta en markdown.
 * - `done`: `sources` son los artículos que usó la respuesta (pueden venir vacíos).
 * - `error`: HELP_AI_UNAVAILABLE; la pregunta no se descuenta.
 * `remaining` null: el plan no tiene límite de preguntas.
 */
export type HelpChatEvent =
  | Readonly<{ event: 'articles'; data: HelpArticleLinkDto[] }>
  | Readonly<{ event: 'delta'; data: { text: string } }>
  | Readonly<{ event: 'done'; data: { logId: number; remaining: number | null; sources: HelpArticleLinkDto[] } }>
  | Readonly<{ event: 'error'; data: { code: string; message: string } }>;

// --- Administración (solo SUPERADMIN) ---

export type HelpAdminCategoryDto = Readonly<{
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  position: number;
  isActive: boolean;
  /** Todos, incluidos los borradores. */
  articlesCount: number;
  publishedCount: number;
}>;

/** Sin `slug` se genera desde el nombre. */
export type SaveHelpCategoryDto = Readonly<{
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  position?: number;
  isActive?: boolean;
}>;

export type HelpAdminArticleItemDto = HelpArticleItemDto &
  Readonly<{
    tags: string[];
    isPublished: boolean;
    publishedAt: string | null;
    position: number;
    helpfulCount: number;
    notHelpfulCount: number;
    updatedByName: string | null;
  }>;

export type HelpAdminArticleDto = HelpAdminArticleItemDto &
  Readonly<{ body: string; createdAt: string; createdByName: string | null }>;

export type HelpArticleStatus = 'published' | 'draft';

export type HelpAdminArticleFiltersDto = Readonly<{
  search?: string;
  categoryId?: number;
  module?: HelpModule;
  status?: HelpArticleStatus;
  page?: number;
  perPage?: number;
}>;

/** Al crear son obligatorios categoryId, title, summary, body y module; al editar todo es opcional. */
export type SaveHelpArticleDto = Readonly<{
  categoryId?: number;
  title?: string;
  slug?: string;
  summary?: string;
  body?: string;
  module?: HelpModule;
  routes?: string[];
  tags?: string[];
  position?: number;
  isPublished?: boolean;
}>;

export type HelpArticleVoteDto = Readonly<{
  id: number;
  businessId: number;
  businessName: string | null;
  userName: string | null;
  helpful: boolean;
  comment: string | null;
  updatedAt: string;
}>;

export type HelpChatLogDto = Readonly<{
  id: number;
  createdAt: string;
  businessId: number;
  businessName: string | null;
  userName: string | null;
  question: string;
  route: string | null;
  /** Los que citó la respuesta; `title: null` si el artículo se borró. */
  articles: ReadonlyArray<{ id: number; title: string | null }>;
  answer: string | null;
  helpful: boolean | null;
  feedbackComment: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** HELP_AI_UNAVAILABLE (falló la IA) o CLIENT_ABORTED (el usuario cerró el chat). */
  errorCode: string | null;
}>;

/** Fechas YYYY-MM-DD (America/Santiago). */
export type HelpChatLogFiltersDto = Readonly<{
  helpful?: boolean;
  withoutArticles?: boolean;
  from?: string;
  to?: string;
  businessId?: number;
  page?: number;
  perPage?: number;
}>;

/** Por defecto, el mes en curso; máximo 366 días. `byDay` incluye los días sin preguntas. */
export type HelpUsageDto = Readonly<{
  from: string;
  to: string;
  totals: Readonly<{ questions: number; costUsd: number; helpful: number; notHelpful: number; failed: number }>;
  byDay: ReadonlyArray<{ date: string; questions: number; costUsd: number }>;
  byBusiness: ReadonlyArray<{ businessId: number; businessName: string | null; questions: number; costUsd: number }>;
}>;
