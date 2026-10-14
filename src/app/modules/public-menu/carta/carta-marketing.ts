import { BannerType, MenuThemeDto, ModalFrequency, PublicPackGroupDto, PublicPromotionDto } from '../data-access/dtos/menu-marketing.dto';
import { PublicLocationMenuDto, PublicProductDto } from '../data-access/dtos/public-menu.dto';
import { CartaIconName } from './ui/carta-icon';

// --- Banners ---

export const BANNER_TYPE_META: Record<BannerType, Readonly<{ label: string; icon: CartaIconName }>> = {
  chef_recommendation: { label: 'Recomendación del chef', icon: 'chef-hat' },
  daily_menu: { label: 'Menú del día', icon: 'calendar' },
  promotion: { label: 'Promoción', icon: 'tag' },
  pack: { label: 'Pack', icon: 'package' },
  info: { label: 'Aviso', icon: 'info' },
};

export const bannerMeta = (type: string) => BANNER_TYPE_META[type as BannerType] ?? BANNER_TYPE_META.info;

/** Solo enlaces http(s) (el backend ya lo valida; por si acaso). */
export const safeUrl = (url: string | null) => (url && /^https?:\/\//i.test(url) ? url : null);

// --- Productos ---

/** Todos los productos de la carta por id (sin filtros). */
export function productsById(menu: PublicLocationMenuDto): Map<number, PublicProductDto> {
  const map = new Map<number, PublicProductDto>();
  const add = (list: readonly PublicProductDto[]) => list.forEach((p) => map.set(p.id, p));
  for (const c of menu.categories) {
    add(c.products);
    c.subcategories.forEach((s) => add(s.products));
  }
  add(menu.uncategorized);
  return map;
}

/** "Happy hour · hasta el 31/10" (la fecha en la zona horaria del local). */
export function promotionLabel(promotion: PublicPromotionDto, timeZone: string): string {
  if (!promotion.endsAt) return promotion.name;
  const date = new Date(promotion.endsAt);
  if (Number.isNaN(date.getTime())) return promotion.name;
  let day: string;
  try {
    day = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', timeZone }).format(date);
  } catch {
    day = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit' }).format(date);
  }
  return `${promotion.name} · hasta el ${day.replace(/-/g, '/')}`;
}

/** Variación más barata (la del "desde $X"). */
export function cheapestVariation(product: PublicProductDto) {
  return product.variations.reduce<PublicProductDto['variations'][number] | null>((min, v) => (!min || v.price < min.price ? v : min), null);
}

/** Un grupo obligatorio sin opciones disponibles deja el pack sin poder pedirse. */
export const isPackUnavailable = (groups: readonly PublicPackGroupDto[]) =>
  groups.some((g) => g.minChoices > 0 && g.items.every((i) => i.soldOut));

/** "Elige 1", "Elige de 1 a 2", "Opcional, hasta 2". */
export function packChoiceLabel(group: PublicPackGroupDto): string {
  if (group.minChoices <= 0) return `Opcional, hasta ${group.maxChoices}`;
  if (group.minChoices === group.maxChoices) return `Elige ${group.maxChoices}`;
  return `Elige de ${group.minChoices} a ${group.maxChoices}`;
}

// --- Ventana de ofertas ---

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const offerModalKey = (business: string, location: string, modalId: number) => `redom-menu-modal:${business}/${location}:${modalId}`;

/** Sin almacenamiento disponible se muestra (es preferible a no mostrarla nunca). */
export function shouldShowOfferModal(key: string, frequency: ModalFrequency): boolean {
  try {
    if (frequency === 'once_per_visit') return sessionStorage.getItem(key) === null;
    if (frequency === 'once_per_day') return localStorage.getItem(key) !== today();
  } catch {
    return true;
  }
  return true;
}

export function markOfferModalShown(key: string, frequency: ModalFrequency): void {
  try {
    if (frequency === 'once_per_visit') sessionStorage.setItem(key, '1');
    else if (frequency === 'once_per_day') localStorage.setItem(key, today());
  } catch {
    // Modo privado o almacenamiento lleno: se volverá a mostrar
  }
}

// --- Personalización ---

/** Colores por defecto de Redom (tema claro). */
const REDOM = { primary: '#e11d48', background: '#ffffff', text: '#0c1420', light: '#ffffff', dark: '#0c1420' } as const;

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** El más legible entre el texto oscuro y el claro de Redom. */
const readableOn = (bg: string) => (contrast(REDOM.dark, bg) >= contrast(REDOM.light, bg) ? REDOM.dark : REDOM.light);

/**
 * Variables CSS de la carta con los colores del local. Se definen también las --color-* de Tailwind porque el @theme
 * las resuelve en :root. Sin fondo ni texto elegidos se respeta el modo claro/oscuro del dispositivo.
 */
export function brandingStyle(theme: MenuThemeDto | null | undefined): Record<string, string> {
  if (!theme) return {};
  const pick = (value: unknown) => (typeof value === 'string' && HEX.test(value) ? value : null);
  const primary = pick(theme.primaryColor);
  const background = pick(theme.backgroundColor);
  const text = pick(theme.textColor);
  const vars: Record<string, string> = {};
  const set = (name: string, value: string) => {
    vars[`--${name}`] = value;
    vars[`--color-${name}`] = value;
  };
  if (primary) {
    set('primary', primary);
    set('primary-foreground', readableOn(primary));
  }
  if (background || text) {
    const bg = background ?? REDOM.background;
    let fg = text ?? REDOM.text;
    if (contrast(fg, bg) < 4.5) fg = readableOn(bg);
    set('background', bg);
    set('foreground', fg);
    set('card', `color-mix(in srgb, ${fg} 5%, ${bg})`);
    set('muted', `color-mix(in srgb, ${fg} 10%, ${bg})`);
    set('muted-foreground', `color-mix(in srgb, ${fg} 70%, ${bg})`);
    set('border', `color-mix(in srgb, ${fg} 15%, ${bg})`);
    vars['color-scheme'] = luminance(bg) < 0.2 ? 'dark' : 'light';
  }
  return vars;
}
