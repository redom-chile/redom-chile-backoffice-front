/** Carta pública por local, etapas 1 y 2. Backend: libs/restaurant/public-menu/src/lib/public-menu.types.ts. */
import { MenuOrderingSettingsDto } from './customer-orders.dto';
import { PublicOnlineDto } from './online-orders.dto';
import { ExtraMenuLanguage, MenuLanguage } from './menu-translations.dto';
import { MenuSortMode, PublicChefPicksDto, PublicMenuDesignDto } from './menu-design.dto';
import { ModalFrequency, PriceChannel, PublicBrandingDto, PublicMarketingDto, PublicPackGroupDto, PublicPromotionDto } from './menu-marketing.dto';

// --- Carta pública (sin sesión) ---

export type PublicTagDto = Readonly<{ code: string; name: string; kind: 'diet' | 'allergen' | 'badge' | string; icon: string | null }>;

/** dayOfWeek: 0 = domingo. */
export type PublicScheduleDto = Readonly<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;

/** Rango de una categoría con horario; si endTime < startTime cruza la medianoche. */
export type PublicCategoryRangeDto = Readonly<{ dayOfWeek: number; startTime: string; endTime: string }>;

export type PublicProductDto = Readonly<{
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Códigos de etiquetas (ver tags de la carta). */
  tags: string[];
  soldOut: boolean;
  hasModifiers: boolean;
  /** price: final, con IVA y con la promoción; originalPrice (si no es null) va tachado. No recalcular en el front. */
  variations: ReadonlyArray<{ id: number; name: string; price: number; originalPrice?: number | null }>;
  /** Etapa 2: la mejor promoción vigente (no se suman). */
  promotion?: PublicPromotionDto | null;
  /** Etapa 2: solo productos tipo pack. */
  pack?: Readonly<{ groups: PublicPackGroupDto[] }> | null;
  /** Etapa 3: opciones que el cliente puede agregar (price con IVA, por unidad). */
  modifierSets?: ReadonlyArray<{ id: number; name: string; options: ReadonlyArray<{ variationId: number; name: string; price: number }> }>;
  /** Etapa 8: nota del chef (null sin menu_design) y posición manual. */
  chefNote?: string | null;
  position?: number;
}>;

export type PublicSubcategoryDto = Readonly<{
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  /** false: fuera de su horario (se muestra atenuada). */
  availableNow: boolean;
  /** null: todo el día. */
  schedule: PublicCategoryRangeDto[] | null;
  products: PublicProductDto[];
  /** Etapa 8: ícono (nombre tipo lucide) y posición manual. */
  icon?: string | null;
  position?: number;
}>;

export type PublicCategoryDto = PublicSubcategoryDto & Readonly<{ subcategories: PublicSubcategoryDto[] }>;

export type PublicBusinessDto = Readonly<{
  name: string;
  slug: string;
  publicId: string;
  logoUrl: string | null;
  /** Sin menu_branding: pie "Hecha con Redom". */
  showRedomBadge: boolean;
}>;

export type PublicLocationSummaryDto = Readonly<{ name: string; slug: string; address: string | null; isOpenNow: boolean }>;

/** GET /menus/{negocio}: con un solo local se entra directo. */
export type PublicBusinessMenusDto = Readonly<{ business: PublicBusinessDto; locations: PublicLocationSummaryDto[] }>;

export type PublicLocationDto = Readonly<{
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  timeZone: string;
  isOpenNow: boolean;
  schedule: PublicScheduleDto[];
}>;

/** En la etapa 1 solo se informan. */
export type PublicMenuFeaturesDto = Readonly<{
  marketing: boolean;
  tableOrdering: boolean;
  pickup: boolean;
  delivery: boolean;
  /** Etapa 4. */
  tableRequests?: boolean;
  bookings?: boolean;
}>;

export type PublicLocationMenuDto = Readonly<{
  business: PublicBusinessDto;
  location: PublicLocationDto;
  /** Mesa del QR, o null. */
  table: Readonly<{ id: number; name: string }> | null;
  features: PublicMenuFeaturesDto;
  tags: PublicTagDto[];
  categories: PublicCategoryDto[];
  uncategorized: PublicProductDto[];
  /** Etapa 2: in_store desde el QR de una mesa o si el local no vende online; si no, online. */
  priceChannel?: PriceChannel;
  /** Etapa 2: null si el plan no incluye menu_marketing. */
  marketing?: PublicMarketingDto | null;
  /** Etapa 2: null si el plan no incluye menu_branding. */
  branding?: PublicBrandingDto | null;
  /** Etapa 5: retiro y delivery (null si no aplica). */
  online?: PublicOnlineDto | null;
  /** Etapa 7: idioma de los textos (lo no traducido llega en español) y los que ofrece el local. */
  language?: MenuLanguage;
  availableLanguages?: MenuLanguage[];
  /** Etapa 8 (ausentes = la carta de siempre): diseño, orden, anuncio, historia y recomendaciones del chef. */
  design?: PublicMenuDesignDto;
  sortMode?: MenuSortMode;
  announcement?: Readonly<{ text: string }> | null;
  story?: string | null;
  chefPicks?: PublicChefPicksDto | null;
}>;

/** GET /tables/{qr}: abrir /carta/{businessSlug}/{locationSlug}?qr=… */
export type PublicTableDto = Readonly<{ businessSlug: string; locationSlug: string; table: Readonly<{ id: number; name: string }> }>;

// --- Administración (con sesión) ---

export type MenuSettingsDto = Readonly<{
  locationId: number;
  locationName: string;
  /** null mientras el local o el negocio no tienen dirección pública. */
  locationSlug: string | null;
  businessSlug: string | null;
  /** Ruta pública: /carta/{negocio}/{local}; null sin slugs. */
  publicPath: string | null;
  isPublished: boolean;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  googleReviewUrl: string | null;
  /** Etapa 2: frecuencia de la ventana de ofertas. */
  modalFrequency?: ModalFrequency;
  /** Etapa 3: pedidos del local. */
  ordering?: MenuOrderingSettingsDto;
  /** Etapa 7: idiomas extra que ofrece la carta (plan menu_translations). */
  languages?: ExtraMenuLanguage[];
}>;

/** Solo los campos que cambian. URLs con https://. ordering: solo cambian las claves enviadas. */
export type UpdateMenuSettingsDto = {
  /** Etapa 7. */
  languages?: ExtraMenuLanguage[];
  ordering?: Partial<
    Pick<
      MenuOrderingSettingsDto,
      'tableOrdering' | 'autoAccept' | 'maxOrderTotal' | 'tableRequests' | 'bookings' | 'pickup' | 'delivery' | 'prepMinutes' | 'paymentMethods' | 'bankAccount'
    >
  >;
} & Partial<
  Pick<MenuSettingsDto, 'isPublished' | 'description' | 'address' | 'latitude' | 'longitude' | 'phone' | 'whatsapp' | 'instagram' | 'website' | 'googleReviewUrl' | 'modalFrequency'>
>;

export type SlugAvailabilityDto = Readonly<{
  slug: string;
  available: boolean;
  reason: 'invalid' | 'reserved' | 'taken' | null;
  suggestion: string | null;
}>;

export type ProductTagDto = Readonly<{ id: number; code: string; name: string; kind: 'diet' | 'allergen' | 'badge' | string; icon: string | null; position: number }>;

export type ProductAvailabilityDto = Readonly<{
  productId: number;
  productName: string;
  isHidden: boolean;
  soldOut: boolean;
  /** null: hasta que lo desmarquen. */
  soldOutUntil: string | null;
  updatedAt: string;
}>;

export type UpdateProductAvailabilityDto = Readonly<{ locationId: number; soldOut?: boolean; soldOutUntil?: string | null; isHidden?: boolean }>;

/** Lista vacía = todo el día. locationId: solo en ese local (reemplaza a los generales ahí). */
export type CategoryScheduleRangeDto = Readonly<{ locationId?: number | null; dayOfWeek: number; startTime: string; endTime: string }>;
