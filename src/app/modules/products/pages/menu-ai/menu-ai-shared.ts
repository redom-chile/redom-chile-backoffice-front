import { DAY_NAMES } from 'src/app/modules/public-menu/data-access';
import { AI_INSIGHT_METRICS, AiInsightKind, AiInsightMetric, AiInsightMetricsDto, AiLength, AiQuotaDto, AiTone } from './data-access';

export type MenuAiTab = 'overview' | 'descriptions' | 'tags' | 'insights' | 'settings';

export const MENU_AI_TABS: ReadonlyArray<{ id: MenuAiTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Resumen', icon: 'dashboard' },
  { id: 'descriptions', label: 'Descripciones', icon: 'edit_note' },
  { id: 'tags', label: 'Etiquetas', icon: 'sell' },
  { id: 'insights', label: 'Sugerencias', icon: 'lightbulb' },
  { id: 'settings', label: 'Configuración', icon: 'tune' },
];

export const isMenuAiTab = (value: string | null): value is MenuAiTab => MENU_AI_TABS.some((tab) => tab.id === value);

export const UNAVAILABLE_MESSAGE = 'Este servidor no tiene la IA para la carta. Avísale a soporte.';

export const DESCRIPTION_MAX: Record<AiLength, number> = { short: 160, medium: 320 };
/** Máximo de productos por pedido de sugerencias y por aplicación. */
export const SUGGEST_MAX = 20;
export const APPLY_CHUNK = 50;
export const TAGS_PICK_MAX = 50;

export const TONES: ReadonlyArray<{ id: AiTone; label: string; example: string }> = [
  { id: 'friendly', label: 'Cercano', example: 'Nuestro lomo saltado de siempre, jugoso y con papas fritas recién hechas.' },
  { id: 'formal', label: 'Formal', example: 'Lomo de vacuno salteado al wok con cebolla morada, tomate y papas fritas.' },
  { id: 'fun', label: 'Divertido', example: 'El lomo saltado que te hace bailar: jugoso, con papas fritas y mucho sabor.' },
];

export const LENGTHS: ReadonlyArray<{ id: AiLength; label: string; detail: string }> = [
  { id: 'short', label: 'Corta', detail: `Hasta ${DESCRIPTION_MAX.short} caracteres` },
  { id: 'medium', label: 'Media', detail: `Hasta ${DESCRIPTION_MAX.medium} caracteres` },
];

export const INSIGHT_KINDS: Record<AiInsightKind, { icon: string; label: string; tone: string }> = {
  lowMargin: { icon: 'trending_down', label: 'Margen bajo', tone: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  priceIncrease: { icon: 'price_change', label: 'Precio', tone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300' },
  slowDayPromo: { icon: 'event', label: 'Día flojo', tone: 'bg-sky-500/15 text-sky-800 dark:text-sky-300' },
  starProduct: { icon: 'star', label: 'Estrella', tone: 'bg-green-500/15 text-green-800 dark:text-green-300' },
  deadProduct: { icon: 'block', label: 'Sin ventas', tone: 'bg-muted/60 text-muted-foreground' },
};

export const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

export const formatClp = (amount: number) => CLP.format(amount);

/** 0 = domingo. */
export const weekdayName = (weekday: number): string | null => DAY_NAMES[weekday] ?? null;

const percent = (value: number) => `${NUMBER.format(value)}%`;
const units = (value: number) => (value === 1 ? '1 unidad' : `${NUMBER.format(value)} unidades`);

const METRICS: Record<AiInsightMetric, { label: string; format: (value: number) => string | null }> = {
  foodCostPercent: { label: 'Food cost', format: percent },
  marginPercent: { label: 'Margen', format: percent },
  margin: { label: 'Margen por unidad (sin IVA)', format: formatClp },
  units30d: { label: 'Vendidos en 30 días', format: units },
  revenue30d: { label: 'Ventas en 30 días (con IVA)', format: formatClp },
  unitsLastWeek: { label: 'Vendidos la última semana', format: units },
  salesWeekday: { label: 'Día con menos ventas', format: weekdayName },
  salesWeekdayShare: { label: 'Parte de las ventas de ese día', format: percent },
};

/** Cifras de la sugerencia con su etiqueta, en el orden acordado con el backend. */
export function insightMetrics(metrics: AiInsightMetricsDto | null | undefined): { label: string; value: string }[] {
  return AI_INSIGHT_METRICS.flatMap((key) => {
    const value = metrics?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return [];
    const text = METRICS[key].format(value);
    return text ? [{ label: METRICS[key].label, value: text }] : [];
  });
}
