export type ThemeKey = 'primaryColor' | 'backgroundColor' | 'textColor';

export const THEME_KEYS: ThemeKey[] = ['primaryColor', 'backgroundColor', 'textColor'];

/** Colores por defecto de la carta (tema claro de Redom). */
export const DEFAULT_THEME: Record<ThemeKey, string> = { primaryColor: '#E11D48', backgroundColor: '#FFFFFF', textColor: '#0C1420' };

export const THEME_LABELS: Record<ThemeKey, { label: string; hint: string }> = {
  primaryColor: { label: 'Color principal', hint: 'Botones, precios y destacados.' },
  backgroundColor: { label: 'Fondo', hint: 'El fondo de toda la carta.' },
  textColor: { label: 'Texto', hint: 'Nombres y descripciones.' },
};

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** WCAG AA para texto normal. */
export const MIN_CONTRAST = 4.5;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Blanco o casi negro, lo que se lea mejor sobre el color. */
export const readableOn = (background: string) => (contrastRatio('#FFFFFF', background) >= contrastRatio('#0C1420', background) ? '#FFFFFF' : '#0C1420');
