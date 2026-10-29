/** Etapa 11: carta dinámica (planes menuDynamic y menuDynamicPlus). Contrato: docs/backend-prompts/carta-etapa-11-carta-dinamica.md. */

export type MenuMomentMode = 'highlight' | 'only';

/** scheduled: antes de empezar | active: vigente ahora | ended. */
export type MenuDynamicStatus = 'scheduled' | 'active' | 'ended';

type MenuDynamicAuditDto = Readonly<{ businessId: number; createdAt: string; updatedAt: string }>;

export type MenuMomentDto = Readonly<{
  id: number;
  locationId: number;
  name: string;
  icon: string | null;
  /** 0 = domingo … 6. */
  days: number[];
  startTime: string;
  endTime: string;
  mode: MenuMomentMode;
  categoryIds: number[];
  productIds: number[];
  position: number;
  isActive: boolean;
}> &
  MenuDynamicAuditDto;

export type SaveMenuMomentDto = Partial<Omit<MenuMomentDto, 'id' | 'position' | keyof MenuDynamicAuditDto>>;

export type MenuSeasonDto = Readonly<{
  id: number;
  locationId: number | null;
  name: string;
  startsAt: string;
  endsAt: string;
  /** null: se usa el nombre. */
  title: string | null;
  productIds: number[];
  bannerId: number | null;
  isActive: boolean;
  status: MenuDynamicStatus;
}> &
  MenuDynamicAuditDto;

export type SaveMenuSeasonDto = Partial<Omit<MenuSeasonDto, 'id' | 'status' | keyof MenuDynamicAuditDto>>;

export type WeatherRuleDto = Readonly<{ title: string; productIds: number[]; categoryIds: number[] }>;

export type MenuWeatherCondition = 'rain' | 'hot' | 'cold';

export type MenuCurrentWeatherDto = Readonly<{
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  /** La regla que aplica ahora, o null. */
  condition: MenuWeatherCondition | null;
}>;

export type MenuDynamicSettingsDto = Readonly<{
  weather: Readonly<{
    enabled: boolean;
    rain: WeatherRuleDto | null;
    hot: (WeatherRuleDto & Readonly<{ minTempC: number }>) | null;
    cold: (WeatherRuleDto & Readonly<{ maxTempC: number }>) | null;
  }>;
  suggestions: Readonly<{ mode: 'manual' | 'automatic' | 'both'; excludeProductIds: number[]; maxItems: number }>;
}>;

/** Respuesta de GET/PUT: los ajustes con datos del local (solo lectura). */
export type MenuDynamicSettingsViewDto = MenuDynamicSettingsDto &
  Readonly<{
    locationId: number;
    /** El local tiene latitud y longitud (lo necesita el clima). */
    hasLocation: boolean;
    /** Clima de ahora (con las reglas de clima encendidas), o null. */
    currentWeather: MenuCurrentWeatherDto | null;
    /** Último cálculo de los productos pedidos juntos, o null. */
    suggestionPairsAt: string | null;
  }>;

export type MenuDailySpecialDto = Readonly<{
  id: number;
  locationId: number;
  productId: number;
  productName: string | null;
  /** null = todas las variaciones. */
  variationId: number | null;
  title: string;
  note: string | null;
  /** Con IVA; null = el de la carta. */
  price: number | null;
  /** null = sin límite. */
  portions: number | null;
  portionsSold: number;
  /** null = sin límite. */
  portionsLeft: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  status: MenuDynamicStatus;
}> &
  MenuDynamicAuditDto;

export type SaveMenuDailySpecialDto = Partial<
  Omit<MenuDailySpecialDto, 'id' | 'portionsSold' | 'portionsLeft' | 'productName' | 'status' | keyof MenuDynamicAuditDto>
>;

export type MenuSuggestionRuleDto = Readonly<{
  id: number;
  locationId: number | null;
  name: string;
  triggerProductIds: number[];
  triggerCategoryIds: number[];
  /** ≤ 6, en orden. */
  suggestProductIds: number[];
  message: string | null;
  position: number;
  isActive: boolean;
}> &
  MenuDynamicAuditDto;

export type SaveMenuSuggestionRuleDto = Partial<Omit<MenuSuggestionRuleDto, 'id' | 'position' | keyof MenuDynamicAuditDto>>;

/** En la carta pública (null: nada activo o sin plan). Todo resuelto para este momento. */
export type PublicMenuDynamicDto = Readonly<{
  moment: Readonly<{ id: number; name: string; icon: string | null; mode: MenuMomentMode; categoryIds: number[]; productIds: number[]; endsAt: string }> | null;
  upcomingMoments: ReadonlyArray<{ id: number; name: string; icon: string | null; startsAt: string }>;
  season: Readonly<{ id: number; name: string; title: string; productIds: number[]; endsAt: string }> | null;
  weather: Readonly<{ condition: MenuWeatherCondition; title: string; productIds: number[]; categoryIds: number[]; temperatureC: number }> | null;
  dailySpecial: Readonly<{
    id: number;
    productId: number;
    variationId: number | null;
    title: string;
    note: string | null;
    price: number | null;
    portionsLeft: number | null;
    endsAt: string;
    soldOut: boolean;
  }> | null;
  suggestionsEnabled: boolean;
}>;

export type PublicSuggestionDto = Readonly<{ productId: number; reason: 'rule' | 'frequentlyTogether'; message: string | null }>;
