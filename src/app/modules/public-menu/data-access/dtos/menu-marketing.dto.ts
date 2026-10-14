/** Carta pública, etapa 2: marketing y personalización. Backend: libs/restaurant/public-menu/src/lib/menu-marketing-dto.ts. */

// --- Carta pública ---

export type BannerType = 'chef_recommendation' | 'daily_menu' | 'promotion' | 'pack' | 'info';
export type BannerLinkType = 'none' | 'product' | 'category' | 'url';
export type ModalFrequency = 'once_per_visit' | 'once_per_day' | 'always';
export type PriceChannel = 'in_store' | 'online';

export type PublicBannerDto = Readonly<{
  id: number;
  type: BannerType;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  link: Readonly<{ type: BannerLinkType; id: number | null; url: string | null }>;
}>;

/** null en la carta: el plan no tiene menu_marketing. */
export type PublicMarketingDto = Readonly<{
  banners: PublicBannerDto[];
  modal: PublicBannerDto | null;
  modalFrequency: ModalFrequency;
  /** Ids de productos, el más vendido primero. */
  mostOrdered: number[];
}>;

/** Colores '#RRGGBB'; la clave falta si no se eligió. */
export type MenuThemeDto = Readonly<{ primaryColor?: string; backgroundColor?: string; textColor?: string }>;

/** null en la carta: el plan no tiene menu_branding. */
export type PublicBrandingDto = Readonly<{ theme: MenuThemeDto; coverUrl: string | null }>;

export type PublicPackGroupDto = Readonly<{
  id: number;
  name: string;
  minChoices: number;
  maxChoices: number;
  items: ReadonlyArray<{ variationId: number; productId: number; name: string; quantity: number; extraPrice: number; isDefault: boolean; soldOut: boolean }>;
}>;

export type PublicPromotionDto = Readonly<{ id: number; name: string; endsAt: string | null }>;

export type MenuEventType = 'menu_view' | 'banner_view' | 'banner_click' | 'modal_view' | 'product_view' | 'pack_view';

/** POST /events: 1 a 20 eventos; refId = banner o producto. */
export type MenuEventsRequestDto = Readonly<{
  businessSlug: string;
  locationSlug: string;
  sessionId?: string;
  events: ReadonlyArray<{ type: MenuEventType; refId?: number }>;
}>;

// --- Administración ---

/** Horario común; sin él, vale siempre. Respuestas: startTime/endTime 'HH:MM:SS'. */
export type MenuScheduleFieldsDto = Readonly<{
  startsAt?: string | null;
  endsAt?: string | null;
  /** 0 domingo … 6 sábado; null o [] = todos. */
  daysOfWeek?: number[] | null;
  startTime?: string | null;
  endTime?: string | null;
}>;

export type PromotionTargetType = 'product' | 'variation' | 'category';
export type PromotionDiscountType = 'percent' | 'amount' | 'fixed_price';

export type CreatePromotionDto = MenuScheduleFieldsDto &
  Readonly<{
    name: string;
    targetType: PromotionTargetType;
    targetId: number;
    discountType: PromotionDiscountType;
    /** > 0; percent ≤ 100; amount y fixed_price con IVA. */
    value: number;
    /** Por defecto ambos. */
    channels?: PriceChannel[];
    /** null: todos los locales. */
    locationId?: number | null;
    isActive?: boolean;
  }>;

export type UpdatePromotionDto = Partial<CreatePromotionDto>;

export type PromotionDto = Readonly<{
  id: number;
  locationId: number | null;
  name: string;
  targetType: PromotionTargetType;
  targetId: number;
  targetName: string;
  discountType: PromotionDiscountType;
  /** Decimal en texto: usar Number(). */
  value: string;
  channels: PriceChannel[];
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateBannerDto = MenuScheduleFieldsDto &
  Readonly<{
    type: BannerType;
    title: string;
    subtitle?: string | null;
    display?: 'banner' | 'modal';
    imageFileId?: string | null;
    linkType?: BannerLinkType;
    linkId?: number | null;
    linkUrl?: string | null;
    locationId?: number | null;
    isActive?: boolean;
  }>;

export type UpdateBannerDto = Partial<CreateBannerDto>;

export type BannerDto = Readonly<{
  id: number;
  locationId: number | null;
  type: BannerType;
  display: 'banner' | 'modal';
  title: string;
  subtitle: string | null;
  imageFileId: string | null;
  imageUrl: string | null;
  linkType: BannerLinkType;
  linkId: number | null;
  linkUrl: string | null;
  position: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  daysOfWeek: number[] | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type PackGroupInputDto = Readonly<{
  name: string;
  minChoices: number;
  maxChoices: number;
  items: ReadonlyArray<{ variationId: number; quantity?: number; extraPrice?: number; isDefault?: boolean }>;
}>;

export type PackDto = Readonly<{
  productId: number;
  groups: ReadonlyArray<{
    id: number;
    name: string;
    minChoices: number;
    maxChoices: number;
    position: number;
    items: ReadonlyArray<{ id: number; variationId: number; name: string; quantity: number; extraPrice: number; isDefault: boolean; position: number }>;
  }>;
}>;

export type BrandingDto = Readonly<{ locationId: number; theme: MenuThemeDto; coverFileId: string | null; coverUrl: string | null }>;

/** null en un color: vuelve al por defecto. coverFileId null: quita la portada. */
export type UpdateBrandingDto = Readonly<{
  theme?: Readonly<{ primaryColor?: string | null; backgroundColor?: string | null; textColor?: string | null }>;
  coverFileId?: string | null;
}>;
