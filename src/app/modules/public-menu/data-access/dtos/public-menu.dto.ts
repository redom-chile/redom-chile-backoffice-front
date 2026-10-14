/** Carta pública por local, etapa 1. Backend: libs/restaurant/public-menu/src/lib/public-menu.types.ts. */

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
  /** price: final, con IVA. */
  variations: ReadonlyArray<{ id: number; name: string; price: number }>;
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
export type PublicMenuFeaturesDto = Readonly<{ marketing: boolean; tableOrdering: boolean; pickup: boolean; delivery: boolean }>;

export type PublicLocationMenuDto = Readonly<{
  business: PublicBusinessDto;
  location: PublicLocationDto;
  /** Mesa del QR, o null. */
  table: Readonly<{ id: number; name: string }> | null;
  features: PublicMenuFeaturesDto;
  tags: PublicTagDto[];
  categories: PublicCategoryDto[];
  uncategorized: PublicProductDto[];
}>;

/** GET /tables/{qr}: abrir /carta/{businessSlug}/{locationSlug}?qr=… */
export type PublicTableDto = Readonly<{ businessSlug: string; locationSlug: string; table: Readonly<{ id: number; name: string }> }>;

// --- Administración (con sesión) ---

export type MenuSettingsDto = Readonly<{
  locationId: number;
  locationName: string;
  locationSlug: string;
  businessSlug: string;
  /** Ruta pública: /carta/{negocio}/{local}. */
  publicPath: string;
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
}>;

/** Solo los campos que cambian. URLs con https://. */
export type UpdateMenuSettingsDto = Partial<
  Pick<MenuSettingsDto, 'isPublished' | 'description' | 'address' | 'latitude' | 'longitude' | 'phone' | 'whatsapp' | 'instagram' | 'website' | 'googleReviewUrl'>
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
