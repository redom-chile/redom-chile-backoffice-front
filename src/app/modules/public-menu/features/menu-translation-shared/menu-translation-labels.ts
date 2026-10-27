import { readApiError } from 'src/app/core/utils/api-error';
import {
  AiTranslationScope,
  ExtraMenuLanguage,
  getPublicMenuErrorMessage,
  MenuTranslationItemDto,
  TranslationEntity,
  TranslationField,
  TranslationFilter,
} from 'src/app/modules/public-menu/data-access';

export const LANGUAGE_LABELS: Record<ExtraMenuLanguage, { name: string; flag: string; short: string }> = {
  en: { name: 'Inglés', flag: '🇬🇧', short: 'EN' },
  pt: { name: 'Portugués', flag: '🇧🇷', short: 'PT' },
  de: { name: 'Alemán', flag: '🇩🇪', short: 'DE' },
};

export const ENTITY_LABELS: Record<TranslationEntity, string> = {
  product: 'Producto',
  variation: 'Variación',
  category: 'Categoría',
  banner: 'Banner',
  promotion: 'Promoción',
  pack_group: 'Grupo de pack',
  location: 'Local',
};

/** Filtro por tipo (plural). */
export const ENTITY_FILTERS: ReadonlyArray<{ id: TranslationEntity; label: string }> = [
  { id: 'product', label: 'Productos' },
  { id: 'variation', label: 'Variaciones' },
  { id: 'category', label: 'Categorías' },
  { id: 'banner', label: 'Banners' },
  { id: 'promotion', label: 'Promociones' },
  { id: 'pack_group', label: 'Grupos de packs' },
  { id: 'location', label: 'Local' },
];

export const FIELD_LABELS: Record<TranslationField, string> = {
  name: 'nombre',
  description: 'descripción',
  title: 'título',
  subtitle: 'subtítulo',
  chef_note: 'nota del chef',
  announcement: 'anuncio',
  story: 'historia',
  chef_picks_title: 'título de las recomendaciones',
};

export type SummaryKey = Exclude<TranslationFilter, 'all'>;

export const STATUS_FILTERS: ReadonlyArray<{ id: TranslationFilter; label: string }> = [
  { id: 'missing', label: 'Sin traducir' },
  { id: 'outdated', label: 'Desactualizadas' },
  { id: 'draft', label: 'Borradores' },
  { id: 'published', label: 'Publicadas' },
  { id: 'all', label: 'Todas' },
];

export const AI_SCOPES: ReadonlyArray<{ id: AiTranslationScope; label: string; description: string }> = [
  { id: 'missing_and_outdated', label: 'Sin traducir y desactualizadas', description: 'Todo lo que falta o cambió en el original.' },
  { id: 'missing', label: 'Solo sin traducir', description: 'Los textos que todavía no tienen traducción.' },
  { id: 'outdated', label: 'Solo desactualizadas', description: 'Las traducciones cuyo original cambió.' },
];

export const OUTDATED_TEXT = 'El original cambió; revisa la traducción';

/** Máximo del backend por texto. */
export const TRANSLATION_MAX_LENGTH = 2000;

export const isExtraLanguage = (value: unknown): value is ExtraMenuLanguage => value === 'en' || value === 'pt' || value === 'de';
export const isTranslationFilter = (value: unknown): value is TranslationFilter => STATUS_FILTERS.some((filter) => filter.id === value);
export const isTranslationEntity = (value: unknown): value is TranslationEntity => ENTITY_FILTERS.some((filter) => filter.id === value);

/** Clave única de un texto traducible. */
export const translationKey = (item: Pick<MenuTranslationItemDto, 'entity' | 'entityId' | 'field'>) => `${item.entity}:${item.entityId}:${item.field}`;

/** Cuota del mes informada por el backend (respuesta de la IA o error 429). */
export type AiQuota = Readonly<{ used: number; limit: number }>;

export function quotaFromError(error: unknown): AiQuota | null {
  const details = readApiError(error).details as Partial<AiQuota> | undefined;
  return typeof details?.used === 'number' && typeof details?.limit === 'number' ? { used: details.used, limit: details.limit } : null;
}

export function translationErrorMessage(error: unknown, fallback: string): string {
  const api = readApiError(error);
  if (api.status === 403 && api.code !== 'PLAN_FEATURE_NOT_INCLUDED') return 'No tienes permiso para hacer este cambio.';
  if (api.status === 400 && !api.code) return 'Revisa los textos: hay uno vacío o demasiado largo.';
  return getPublicMenuErrorMessage(error, fallback);
}
