/** Etapa 9: contenido de la carta con IA (plan menuAiContent). Backend: libs/restaurant/menu-ai. */

export type AiTone = 'friendly' | 'formal' | 'fun';
export type AiLength = 'short' | 'medium';
export type AiInsightsFrequency = 'weekly' | 'monthly';

/** limit null: sin límite. */
export type AiQuotaDto = Readonly<{ used: number; limit: number | null }>;

export type AiSettingsDto = Readonly<{
  isEnabled: boolean;
  tone: AiTone;
  length: AiLength;
  /** Tope propio por debajo del plan; null = el del plan. */
  monthlyLimit: number | null;
  insightsEnabled: boolean;
  insightsFrequency: AiInsightsFrequency;
  quota: AiQuotaDto & Readonly<{ planLimit: number | null }>;
  updatedAt: string | null;
}>;

export type UpdateAiSettingsDto = Partial<Omit<AiSettingsDto, 'quota' | 'updatedAt'>>;

export type DescriptionSuggestionsDto = Readonly<{
  /** options vacío: ninguna pasó las reglas (no cuenta en la cuota). */
  suggestions: ReadonlyArray<{ productId: number; productName: string; current: string | null; options: string[] }>;
  /** Con scope 'missing': productos sin descripción que quedan. */
  remaining: number;
  quota: AiQuotaDto;
}>;

/** productIds (≤20) o scope 'missing' (de a 20); excludeIds: los omitidos en la sesión (solo con 'missing'). */
export type RequestDescriptionsDto = Readonly<{ productIds?: number[]; scope?: 'missing'; excludeIds?: number[]; tone?: AiTone; length?: AiLength }>;

export type ApplyDescriptionsDto = Readonly<{ items: ReadonlyArray<{ productId: number; description: string }> }>;

export type TagRefDto = Readonly<{ code: string; name: string; kind: 'diet' | 'allergen' | 'badge' | string }>;
export type TagSuggestionDto = TagRefDto & Readonly<{ reason: string }>;

export type TagSuggestionsDto = Readonly<{
  /** current: todas sus etiquetas de hoy; los cambios se aplican sobre ellas. */
  suggestions: ReadonlyArray<{ productId: number; productName: string; current: TagRefDto[]; add: TagSuggestionDto[]; remove: TagSuggestionDto[] }>;
}>;

export type AiOverviewDto = Readonly<{
  counts: Readonly<{ products: number; withoutDescription: number; withoutPhoto: number; withoutTags: number; lowMargin: number }>;
  quota: AiQuotaDto;
  settings: Readonly<{ isEnabled: boolean; insightsEnabled: boolean }>;
  lastInsightsAt: string | null;
}>;

export type AiInsightKind = 'lowMargin' | 'priceIncrease' | 'slowDayPromo' | 'starProduct' | 'deadProduct';

export type AiInsightActionDto =
  /** suggestedPrice: con IVA, redondeado a $100. */
  | Readonly<{ type: 'editPrice'; productId: number; suggestedPrice: number }>
  /** weekday 0 = domingo … 6 = sábado. */
  | Readonly<{ type: 'createPromotion'; productId: number; weekday: number; suggestedPercent: number }>
  | Readonly<{ type: 'editProduct'; productId: number }>;

export const AI_INSIGHT_METRICS = [
  'foodCostPercent',
  'marginPercent',
  'margin',
  'units30d',
  'revenue30d',
  'unitsLastWeek',
  'salesWeekday',
  'salesWeekdayShare',
] as const;
export type AiInsightMetric = (typeof AI_INSIGHT_METRICS)[number];
/** Solo las que aplican. margin: $ por unidad sin IVA; revenue30d: $ con IVA; salesWeekday: 0 = domingo. */
export type AiInsightMetricsDto = Readonly<Partial<Record<AiInsightMetric, number>>>;

/** Campos que puede marcar AI_SETTINGS_INVALID (details.field) y ajustes que pide AI_CONTENT_DISABLED (details.setting). */
export type AiSettingsField = 'isEnabled' | 'tone' | 'length' | 'monthlyLimit' | 'insightsEnabled' | 'insightsFrequency';

export type AiInsightDto = Readonly<{
  id: number;
  kind: AiInsightKind;
  productId: number | null;
  productName: string | null;
  title: string;
  detail: string;
  metrics: AiInsightMetricsDto;
  action: AiInsightActionDto | null;
  createdAt: string;
}>;
