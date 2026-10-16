/** Etapa 7: carta en varios idiomas. Backend: libs/restaurant/public-menu/src/lib/menu-translations*.ts. */

export type MenuLanguage = 'es' | 'en' | 'pt' | 'de';
/** Los que el local puede ofrecer además del español. */
export type ExtraMenuLanguage = Exclude<MenuLanguage, 'es'>;
export const EXTRA_MENU_LANGUAGES: readonly ExtraMenuLanguage[] = ['en', 'pt', 'de'];

export type TranslationEntity = 'product' | 'variation' | 'category' | 'banner' | 'promotion' | 'pack_group' | 'location';
export type TranslationField = 'name' | 'description' | 'title' | 'subtitle';
export type TranslationStatus = 'draft' | 'published';
export type TranslationFilter = 'missing' | 'outdated' | 'draft' | 'published' | 'all';
export type AiTranslationScope = 'missing' | 'outdated' | 'missing_and_outdated';

export type MenuTranslationItemDto = Readonly<{
  entity: TranslationEntity;
  entityId: number;
  field: TranslationField;
  original: string;
  translation: Readonly<{
    id: number;
    text: string;
    source: 'manual' | 'ai';
    status: TranslationStatus;
    /** El original cambió después de traducir. */
    outdated: boolean;
    updatedAt: string;
  }> | null;
}>;

export type MenuTranslationsPageDto = Readonly<{
  language: ExtraMenuLanguage;
  summary: Readonly<{ missing: number; outdated: number; draft: number; published: number }>;
  total: number;
  items: MenuTranslationItemDto[];
}>;

export type MenuTranslationsQuery = Readonly<{
  language: ExtraMenuLanguage;
  status?: TranslationFilter;
  entity?: TranslationEntity;
  limit?: number;
  offset?: number;
}>;

/** Hasta 500 items. */
export type SaveMenuTranslationsDto = Readonly<{
  language: ExtraMenuLanguage;
  items: ReadonlyArray<{ entity: TranslationEntity; entityId: number; field: TranslationField; text: string; status?: TranslationStatus }>;
}>;

/** Hasta 150 por llamada; remaining > 0: ofrecer continuar. */
export type AiTranslationResultDto = Readonly<{ translated: number; remaining: number; quota: Readonly<{ used: number; limit: number }> }>;
