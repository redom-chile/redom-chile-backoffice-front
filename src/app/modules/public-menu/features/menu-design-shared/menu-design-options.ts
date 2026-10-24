import { MenuCardStyle, MenuFont, MenuTemplate } from 'src/app/modules/public-menu/data-access';

export const ANNOUNCEMENT_MAX = 160;
export const STORY_MAX = 1000;
export const CHEF_TITLE_MAX = 60;
export const DEFAULT_CHEF_TITLE = 'Recomendación del chef';
export const CHEF_TITLE_SUGGESTIONS = ['Recomendación del chef', 'Sugerencias de la casa', 'Favoritos del chef'] as const;

export const TEMPLATE_OPTIONS: ReadonlyArray<{ id: MenuTemplate; name: string; description: string }> = [
  { id: 'classic', name: 'Clásica', description: 'La carta de siempre: ordenada y fácil de leer.' },
  { id: 'minimal', name: 'Minimal', description: 'Mucho aire y pocos adornos, el foco en los platos.' },
  { id: 'magazine', name: 'Revista', description: 'Fotos grandes en una columna, como una revista.' },
  { id: 'chalkboard', name: 'Pizarra', description: 'Estilo bistró, sin fotos y con letra de tiza.' },
  { id: 'grid', name: 'Grilla', description: 'Dos columnas de fotos para recorrer rápido.' },
];

/** Nombres del par de cada tipografía; las familias y la carga real están en carta/carta-design.ts. */
export const FONT_OPTIONS: ReadonlyArray<{ id: MenuFont; name: string; heading: string; body: string }> = [
  { id: 'modern', name: 'Moderna', heading: 'Poppins', body: 'Inter' },
  { id: 'classic', name: 'Clásica', heading: 'Lora', body: 'Open Sans' },
  { id: 'elegant', name: 'Elegante', heading: 'Playfair Display', body: 'Lato' },
  { id: 'rustic', name: 'Rústica', heading: 'Bitter', body: 'Source Sans 3' },
  { id: 'playful', name: 'Divertida', heading: 'Baloo 2', body: 'Nunito' },
  { id: 'minimal', name: 'Minimal', heading: 'Inter', body: 'Inter' },
  { id: 'bistro', name: 'Bistró', heading: 'Caveat', body: 'Josefin Sans' },
];

export const CARD_STYLE_OPTIONS: ReadonlyArray<{ id: MenuCardStyle; name: string; description: string; icon: string }> = [
  { id: 'list', name: 'Lista', description: 'Foto chica al lado', icon: 'view_list' },
  { id: 'photo', name: 'Foto grande', description: 'La foto arriba del nombre', icon: 'image' },
  { id: 'text', name: 'Solo texto', description: 'Sin fotos', icon: 'notes' },
];

/** Tarjeta sugerida al elegir una plantilla. */
export const SUGGESTED_CARD_STYLE: Readonly<Record<MenuTemplate, MenuCardStyle>> = {
  classic: 'list',
  minimal: 'list',
  magazine: 'photo',
  grid: 'photo',
  chalkboard: 'text',
};

export const templateName = (id: string) => TEMPLATE_OPTIONS.find((option) => option.id === id)?.name ?? id;
export const fontName = (id: string) => FONT_OPTIONS.find((option) => option.id === id)?.name ?? id;
export const cardStyleName = (id: string) => CARD_STYLE_OPTIONS.find((option) => option.id === id)?.name ?? id;
