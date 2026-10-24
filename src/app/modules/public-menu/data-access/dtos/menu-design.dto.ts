/**
 * Etapa 8: diseño de la carta (plan menu_design). Contrato: docs/backend-prompts/carta-etapa-8-diseno.md.
 * Mientras el backend no lo publique, los campos públicos llegan ausentes y la carta se ve como hoy.
 */

export const MENU_TEMPLATES = ['classic', 'minimal', 'magazine', 'chalkboard', 'grid'] as const;
export type MenuTemplate = (typeof MENU_TEMPLATES)[number];

export const MENU_FONTS = ['modern', 'classic', 'elegant', 'rustic', 'playful', 'minimal', 'bistro'] as const;
export type MenuFont = (typeof MENU_FONTS)[number];

export const MENU_CARD_STYLES = ['list', 'photo', 'text'] as const;
export type MenuCardStyle = (typeof MENU_CARD_STYLES)[number];

export type MenuSortMode = 'manual' | 'alphabetical';

export type MenuAccessibilityDto = Readonly<{ highContrast: boolean; readAloud: boolean }>;

export type MenuAnnouncementDto = Readonly<{ text: string; startsAt: string | null; endsAt: string | null; isActive: boolean }>;

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

export type UpdateMenuDesignDto = Partial<Omit<MenuDesignDto, 'updatedAt'>>;

export type MenuDesignVersionDto = Readonly<{
  id: number;
  design: MenuDesignDto;
  createdAt: string;
  createdBy: Readonly<{ code: string; name: string }> | null;
}>;

export type MenuChefScheduleDto = Readonly<{ dayOfWeek: number; startTime: string; endTime: string }>;

export type ChefPicksDto = Readonly<{
  isActive: boolean;
  title: string;
  photoFileId: string | null;
  photoUrl: string | null;
  /** En orden; máximo 12. */
  productIds: number[];
  products: ReadonlyArray<{ id: number; name: string; imageUrl: string | null; soldOut: boolean; hidden: boolean }>;
  /** Vacío: siempre. */
  schedule: MenuChefScheduleDto[];
  updatedAt: string | null;
}>;

export type SaveChefPicksDto = Readonly<{
  isActive: boolean;
  title: string;
  photoFileId: string | null;
  productIds: number[];
  schedule: MenuChefScheduleDto[];
}>;

export const CHEF_PICKS_MAX = 12;

/** En la carta pública: solo si está activa y dentro de su horario. */
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
