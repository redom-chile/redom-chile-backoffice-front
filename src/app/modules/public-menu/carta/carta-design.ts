import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import {
  MENU_CARD_STYLES,
  MENU_FONTS,
  MENU_TEMPLATES,
  MenuCardStyle,
  MenuFont,
  MenuTemplate,
  PublicMenuDesignDto,
} from '../data-access/dtos/menu-design.dto';
import { PublicCategoryDto, PublicLocationMenuDto, PublicProductDto, PublicSubcategoryDto } from '../data-access/dtos/public-menu.dto';

/**
 * Etapa 8: cómo se dibuja la carta según menu.design. Sin design (backend anterior) todo queda como siempre:
 * plantilla classic, tipografía de la app, tarjetas en lista y sin opciones de accesibilidad.
 */
export type CartaDesign = Readonly<{
  template: MenuTemplate;
  font: MenuFont;
  cardStyle: MenuCardStyle;
  categoryStyles: Readonly<Record<string, MenuCardStyle>>;
  highContrast: boolean;
  readAloud: boolean;
}>;

const LEGACY_DESIGN: CartaDesign = {
  template: 'classic',
  font: 'modern',
  cardStyle: 'list',
  categoryStyles: {},
  highContrast: false,
  readAloud: false,
};

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback;

export const isCardStyle = (value: unknown): value is MenuCardStyle => typeof value === 'string' && (MENU_CARD_STYLES as readonly string[]).includes(value);

export function resolveDesign(design: PublicMenuDesignDto | null | undefined): CartaDesign {
  if (!design) return LEGACY_DESIGN;
  return {
    template: oneOf(MENU_TEMPLATES, design.template, 'classic'),
    font: oneOf(MENU_FONTS, design.font, 'modern'),
    cardStyle: oneOf(MENU_CARD_STYLES, design.cardStyle, 'list'),
    categoryStyles: design.categoryStyles ?? {},
    highContrast: !!design.accessibility?.highContrast,
    readAloud: !!design.accessibility?.readAloud,
  };
}

/** La categoría (o subcategoría) con estilo propio lo usa; si no, el de su categoría o el general. */
export function cardStyleFor(design: CartaDesign, id: string | number, parent?: MenuCardStyle): MenuCardStyle {
  const own = design.categoryStyles[String(id)];
  if (isCardStyle(own)) return own;
  if (parent) return parent;
  return design.cardStyle;
}

// --- Orden manual ---

const byPosition = <T extends Readonly<{ name: string; position?: number }>>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'es'));

const sortGroup = <T extends PublicSubcategoryDto>(group: T): T => ({ ...group, products: byPosition<PublicProductDto>(group.products) });

/** sortMode 'manual': categorías, subcategorías y productos por position y nombre; si no, el orden del servidor. */
export function sortMenu(menu: PublicLocationMenuDto): PublicLocationMenuDto {
  if (menu.sortMode !== 'manual') return menu;
  return {
    ...menu,
    categories: byPosition<PublicCategoryDto>(menu.categories).map((c) => ({ ...sortGroup(c), subcategories: byPosition(c.subcategories).map(sortGroup) })),
    uncategorized: byPosition(menu.uncategorized),
  };
}

// --- Tipografías ---

type FontPair = Readonly<{ heading: string; body: string; families: string }>;

/** modern: la de la app (Poppins en la landing), sin pedir nada. */
const FONT_PAIRS: Readonly<Record<Exclude<MenuFont, 'modern'>, FontPair>> = {
  classic: { heading: "'Lora', Georgia, serif", body: "'Open Sans', system-ui, sans-serif", families: 'family=Lora:wght@500;600;700&family=Open+Sans:wght@400;500;600;700' },
  elegant: { heading: "'Playfair Display', Georgia, serif", body: "'Lato', system-ui, sans-serif", families: 'family=Playfair+Display:wght@500;600;700&family=Lato:wght@400;700' },
  rustic: { heading: "'Bitter', Georgia, serif", body: "'Source Sans 3', system-ui, sans-serif", families: 'family=Bitter:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700' },
  playful: { heading: "'Baloo 2', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif", families: 'family=Baloo+2:wght@500;600;700&family=Nunito:wght@400;500;600;700' },
  minimal: { heading: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif", families: 'family=Inter:wght@400;500;600;700' },
  // Amatic SC se lee mal en nombres de productos: Caveat (manuscrita, con tildes y ñ) y Josefin Sans
  bistro: { heading: "'Caveat', 'Comic Sans MS', cursive", body: "'Josefin Sans', system-ui, sans-serif", families: 'family=Caveat:wght@500;600;700&family=Josefin+Sans:wght@400;500;600;700' },
};

export function fontVars(font: MenuFont): Record<string, string> {
  if (font === 'modern') return {};
  const pair = FONT_PAIRS[font];
  return { '--carta-font-heading': pair.heading, '--carta-font-body': pair.body };
}

/** Carga la hoja de Google Fonts de una tipografía una sola vez (landing y vista previa del backoffice). */
@Injectable({ providedIn: 'root' })
export class CartaFonts {
  readonly #document = inject(DOCUMENT);

  load(font: MenuFont): void {
    if (font === 'modern') return;
    const head = this.#document.head;
    if (!head || head.querySelector(`link[data-carta-font="${font}"]`)) return;
    const link = this.#document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${FONT_PAIRS[font].families}&display=swap`;
    link.setAttribute('data-carta-font', font);
    head.appendChild(link);
  }
}

// --- Vista previa ---

const TOKENS = {
  light: { background: '#ffffff', foreground: '#0c1420', card: '#f6f8fb', muted: '#e7edf4', 'muted-foreground': '#5b6b80', border: '#e2e8f0' },
  dark: { background: '#0a0a0a', foreground: '#f2f2f2', card: '#141414', muted: '#262626', 'muted-foreground': '#a3a3a3', border: '#262626' },
} as const;

/** Colores base de la carta (los de la landing) para la vista previa en claro u oscuro, sin depender del backoffice. */
export function previewTokens(dark: boolean): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(TOKENS[dark ? 'dark' : 'light'])) {
    vars[`--${name}`] = value;
    vars[`--color-${name}`] = value;
  }
  vars['color-scheme'] = dark ? 'dark' : 'light';
  return vars;
}

/** Ancestro más cercano con desplazamiento vertical (el marco de la vista previa); null: la ventana. */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  if (typeof getComputedStyle === 'undefined') return null;
  for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return node;
  }
  return null;
}

// --- Plantilla pizarra ---

const CHALK = { bg: '#1f2b2a', fg: '#f3efe3' };

/** Pizarra sin colores de marca propios: fondo de pizarra y texto tiza (también en modo oscuro). */
export function chalkboardVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  const set = (name: string, value: string) => {
    vars[`--${name}`] = value;
    vars[`--color-${name}`] = value;
  };
  set('background', CHALK.bg);
  set('foreground', CHALK.fg);
  set('card', `color-mix(in srgb, ${CHALK.fg} 6%, ${CHALK.bg})`);
  set('muted', `color-mix(in srgb, ${CHALK.fg} 12%, ${CHALK.bg})`);
  set('muted-foreground', `color-mix(in srgb, ${CHALK.fg} 78%, ${CHALK.bg})`);
  set('border', `color-mix(in srgb, ${CHALK.fg} 22%, ${CHALK.bg})`);
  vars['color-scheme'] = 'dark';
  return vars;
}

/**
 * Estilos de las plantillas, tarjetas, tipografías y alto contraste. Sin capa: ganan a las utilidades de Tailwind.
 * Todo cuelga de las clases del host (carta-tpl-*, carta-font-*, carta-hc), así que classic no cambia nada.
 */
export const CARTA_DESIGN_CSS = `
.carta-font-custom { font-family: var(--carta-font-body); }
.carta-font-custom :is(h1, h2, h3, .carta-heading) { font-family: var(--carta-font-heading); }
.carta-font-bistro :is(h1, h2, h3, .carta-heading) { font-size-adjust: 0.5; letter-spacing: 0.01em; }

.carta-leader { flex: 1 1 1rem; min-width: 1rem; border-bottom: 2px dotted color-mix(in srgb, currentColor 35%, transparent); transform: translateY(-0.3em); }

.carta-tpl-minimal .carta-hero-glow, .carta-tpl-chalkboard .carta-hero-glow { display: none; }
.carta-tpl-minimal .carta-cover { height: 7rem; }
.carta-tpl-minimal .carta-section { padding-top: 2.5rem; }
.carta-tpl-minimal .carta-section-title { font-size: 1.125rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.carta-tpl-minimal .carta-products:not(.carta-products-grid) { gap: 0; }
.carta-tpl-minimal .carta-products:not(.carta-products-grid) .carta-card { border-width: 0 0 1px; border-radius: 0; background: transparent; }
.carta-tpl-minimal .carta-products:not(.carta-products-grid) .carta-card-body { padding-left: 0; padding-right: 0; }

.carta-tpl-magazine .carta-title { font-size: 2rem; }
.carta-tpl-magazine .carta-section { padding-top: 2.5rem; }
.carta-tpl-magazine .carta-section-title { font-size: 2rem; line-height: 1.1; }
.carta-tpl-magazine .carta-sub-title { font-size: 1.25rem; }
.carta-tpl-magazine .carta-products { gap: 1.25rem; }
.carta-tpl-magazine .carta-card-photo { aspect-ratio: 16 / 10; }
.carta-tpl-magazine .carta-card[data-variant='photo'] .carta-card-name { font-size: 1.25rem; }

.carta-tpl-chalkboard.carta-chalk { background-image: radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.06), transparent 70%); }
.carta-tpl-chalkboard .carta-section-title { text-align: center; letter-spacing: 0.06em; text-transform: uppercase; }
.carta-tpl-chalkboard .carta-section-title::after { content: ''; display: block; width: 4rem; margin: 0.5rem auto 0; border-bottom: 2px dashed color-mix(in srgb, currentColor 45%, transparent); }
.carta-tpl-chalkboard .carta-products:not(.carta-products-grid) .carta-card { background: transparent; border-color: transparent; }

.carta-tpl-grid .carta-products-grid .carta-card-name { font-size: 0.9375rem; }

.carta-hc {
  --background: #ffffff !important; --color-background: #ffffff !important;
  --foreground: #000000 !important; --color-foreground: #000000 !important;
  --card: #ffffff !important; --color-card: #ffffff !important;
  --muted: #ebebeb !important; --color-muted: #ebebeb !important;
  --muted-foreground: #000000 !important; --color-muted-foreground: #000000 !important;
  --border: #000000 !important; --color-border: #000000 !important;
  color-scheme: light !important;
  background-image: none !important;
}
.carta-hc.carta-hc-dark {
  --background: #000000 !important; --color-background: #000000 !important;
  --foreground: #ffffff !important; --color-foreground: #ffffff !important;
  --card: #000000 !important; --color-card: #000000 !important;
  --muted: #1f1f1f !important; --color-muted: #1f1f1f !important;
  --muted-foreground: #ffffff !important; --color-muted-foreground: #ffffff !important;
  --border: #ffffff !important; --color-border: #ffffff !important;
  color-scheme: dark !important;
}
.carta-hc .border { border-width: 2px; }
.carta-hc .border-y { border-top-width: 2px; border-bottom-width: 2px; }
.carta-hc .border-t { border-top-width: 2px; }
.carta-hc .border-b { border-bottom-width: 2px; }
.carta-hc .divide-y > :not(:last-child) { border-bottom-width: 2px; }
.carta-hc a { text-decoration: underline; text-underline-offset: 3px; }
.carta-hc .text-primary { color: var(--foreground); }
.carta-hc .opacity-60 { opacity: 0.8; }
.carta-hc .carta-leader { border-bottom-color: currentColor; }
`;
