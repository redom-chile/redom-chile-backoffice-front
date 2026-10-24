/**
 * Etapa 8: diseño de la carta (plan menu_design; la accesibilidad en todos los planes).
 * Backend: libs/restaurant/public-menu/src/lib/menu-design-dto.ts.
 */
import { MenuThemeDto } from './menu-marketing.dto';

export const MENU_TEMPLATES = ['classic', 'minimal', 'magazine', 'chalkboard', 'grid'] as const;
export type MenuTemplate = (typeof MENU_TEMPLATES)[number];

export const MENU_FONTS = ['modern', 'classic', 'elegant', 'rustic', 'playful', 'minimal', 'bistro'] as const;
export type MenuFont = (typeof MENU_FONTS)[number];

export const MENU_CARD_STYLES = ['list', 'photo', 'text'] as const;
export type MenuCardStyle = (typeof MENU_CARD_STYLES)[number];

export type MenuSortMode = 'manual' | 'alphabetical';

export type MenuAccessibilityDto = Readonly<{ highContrast: boolean; readAloud: boolean }>;

/** Fechas ISO (UTC al leer). */
export type MenuAnnouncementDto = Readonly<{ text: string; startsAt: string | null; endsAt: string | null; isActive: boolean }>;

/** Al guardar va completo: text 1-160, fechas ISO con offset (null = sin fecha), isActive por defecto true. */
export type MenuAnnouncementInputDto = Readonly<{ text: string; startsAt?: string | null; endsAt?: string | null; isActive?: boolean }>;

/** Lo que usa la carta para dibujarse (público y vista previa). */
export type PublicMenuDesignDto = Readonly<{
  template: MenuTemplate;
  font: MenuFont;
  cardStyle: MenuCardStyle;
  /** Por id de categoría. */
  categoryStyles: Readonly<Record<string, MenuCardStyle>>;
  accessibility: MenuAccessibilityDto;
}>;

export const DEFAULT_MENU_DESIGN: PublicMenuDesignDto = {
  template: 'classic',
  font: 'modern',
  cardStyle: 'list',
  categoryStyles: {},
  accessibility: { highContrast: true, readAloud: true },
};

export type MenuDesignDto = PublicMenuDesignDto & Readonly<{ announcement: MenuAnnouncementDto | null; updatedAt: string | null }>;

/**
 * PATCH parcial. categoryStyles reemplaza el mapa completo; accessibility se mezcla; announcement null lo quita.
 * Sin menu_design solo se puede enviar accessibility (lo demás responde 403).
 */
export type UpdateMenuDesignDto = Readonly<{
  template?: MenuTemplate;
  font?: MenuFont;
  cardStyle?: MenuCardStyle;
  categoryStyles?: Readonly<Record<string, MenuCardStyle>>;
  accessibility?: Partial<MenuAccessibilityDto>;
  announcement?: MenuAnnouncementInputDto | null;
}>;

/** Campo de details.field en 400 MENU_DESIGN_INVALID (categoryStyles.{id}, accessibility.{key}). */
export type MenuDesignErrorField =
  | 'template'
  | 'font'
  | 'cardStyle'
  | 'categoryStyles'
  | `categoryStyles.${string}`
  | `accessibility.${string}`
  | 'announcement.text'
  | 'announcement.startsAt'
  | 'announcement.endsAt'
  | 'announcement.isActive'
  | 'story';

export type MenuDesignVersionDto = Readonly<{
  id: number;
  design: MenuDesignDto;
  /** Colores, portada e historia de ese momento (también se restauran). */
  branding: Readonly<{ theme: MenuThemeDto; coverFileId: string | null; story: string | null }>;
  createdAt: string;
  createdBy: Readonly<{ code: string; name: string | null }> | null;
}>;

export type MenuChefScheduleDto = Readonly<{ dayOfWeek: number; startTime: string; endTime: string }>;

export type ChefPicksDto = Readonly<{
  locationId: number;
  isActive: boolean;
  title: string;
  photoFileId: string | null;
  photoUrl: string | null;
  /** En orden; máximo 12. */
  productIds: number[];
  /** soldOut: agotado ahora en el local; hidden: no se ve en la carta del local (oculto, inactivo, no a la venta o eliminado). */
  products: ReadonlyArray<{ id: number; name: string; imageUrl: string | null; soldOut: boolean; hidden: boolean }>;
  /** Vacío: siempre. */
  schedule: MenuChefScheduleDto[];
  updatedAt: string | null;
}>;

/** PUT parcial: lo que no se envía mantiene su valor. photoFileId: archivo de la carpeta menu_chef (null = sin foto). */
export type SaveChefPicksDto = Readonly<{
  isActive?: boolean;
  title?: string;
  photoFileId?: string | null;
  productIds?: number[];
  schedule?: MenuChefScheduleDto[];
}>;

/** details.reason de 400 CHEF_PICKS_INVALID; not_found y not_for_sale traen details.productIds. */
export type ChefPicksErrorReason = 'too_many' | 'duplicated' | 'not_found' | 'not_for_sale' | 'schedule';

export const CHEF_PICKS_MAX = 12;

/** En la carta pública: activa, dentro de su horario y solo con productos visibles y no agotados (si no, null). */
export type PublicChefPicksDto = Readonly<{ title: string; photoUrl: string | null; productIds: number[] }>;

/** Íconos de categoría (la carta los dibuja en carta/ui/carta-icon.ts; el backend guarda el nombre). */
export const MENU_CATEGORY_ICONS = [
  { name: 'utensils', label: 'Platos' },
  { name: 'salad', label: 'Ensaladas' },
  { name: 'soup', label: 'Sopas' },
  { name: 'beef', label: 'Carnes' },
  { name: 'drumstick', label: 'Pollo' },
  { name: 'fish', label: 'Pescados y mariscos' },
  { name: 'pizza', label: 'Pizzas' },
  { name: 'burger', label: 'Hamburguesas' },
  { name: 'sandwich', label: 'Sándwiches' },
  { name: 'egg', label: 'Desayunos' },
  { name: 'croissant', label: 'Panadería' },
  { name: 'leaf', label: 'Vegano' },
  { name: 'flame', label: 'Parrilla' },
  { name: 'baby', label: 'Infantil' },
  { name: 'cake', label: 'Postres' },
  { name: 'ice-cream', label: 'Helados' },
  { name: 'cookie', label: 'Dulces' },
  { name: 'coffee', label: 'Café' },
  { name: 'cup-soda', label: 'Bebidas' },
  { name: 'glass-water', label: 'Jugos' },
  { name: 'beer', label: 'Cervezas' },
  { name: 'wine', label: 'Vinos' },
  { name: 'martini', label: 'Tragos' },
  { name: 'star', label: 'Destacados' },
] as const;
export type MenuCategoryIcon = (typeof MENU_CATEGORY_ICONS)[number]['name'];
