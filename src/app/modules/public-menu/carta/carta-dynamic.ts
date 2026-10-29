import { PublicMenuDynamicDto } from '../data-access/dtos/menu-dynamic.dto';
import { PublicLocationMenuDto, PublicProductDto } from '../data-access/dtos/public-menu.dto';
import { CartaIconName, categoryIcon } from './ui/carta-icon';

/** Etapa 11: carta dinámica (momento, temporada, clima, plato del día). Todo llega resuelto por el backend. */

export type CartaDynamic = PublicMenuDynamicDto;
export type DailySpecial = NonNullable<CartaDynamic['dailySpecial']>;

/** Una hora del backend ya ubicada: texto "HH:MM" en la zona del local e instante (ms) para comparar. */
export type DynamicTime = Readonly<{ label: string; at: number | null }>;

const hhmm = new Map<string, Intl.DateTimeFormat>();

function formatHour(ts: number, timeZone: string): string {
  let f = hhmm.get(timeZone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
    } catch {
      f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    }
    hhmm.set(timeZone, f);
  }
  return f.format(new Date(ts));
}

/** Instante ISO con zona del backend → hora "HH:MM" del local; null si no se puede leer (la carta sigue igual). */
export function dynamicTime(value: string | null | undefined, timeZone: string): DynamicTime | null {
  if (!value) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : { label: formatHour(at, timeZone), at };
}

/** Íconos que puede elegir un momento: los de las categorías y algunos de la hora del día. */
const MOMENT_ICONS: ReadonlySet<string> = new Set<CartaIconName>(['sun', 'moon', 'clock', 'flame', 'star', 'calendar', 'sparkles', 'chef-hat', 'bell']);

export const momentIcon = (name: string | null | undefined): CartaIconName | null =>
  categoryIcon(name) ?? (name && MOMENT_ICONS.has(name) ? (name as CartaIconName) : null);

export const WEATHER_ICONS: Readonly<Record<NonNullable<CartaDynamic['weather']>['condition'], CartaIconName>> = {
  rain: 'cloud-rain',
  hot: 'sun',
  cold: 'snowflake',
};

/** Productos de los ids y luego los de las categorías (y sus subcategorías), sin repetir ni los que no están. */
export function dynamicProducts(
  menu: PublicLocationMenuDto,
  byId: ReadonlyMap<number, PublicProductDto>,
  productIds: readonly number[] | null | undefined,
  categoryIds: readonly number[] | null | undefined = [],
  max = 20,
): PublicProductDto[] {
  const seen = new Set<number>();
  const list: PublicProductDto[] = [];
  const push = (p: PublicProductDto | undefined) => {
    if (!p || seen.has(p.id) || list.length >= max) return;
    seen.add(p.id);
    list.push(p);
  };
  (productIds ?? []).forEach((id) => push(byId.get(id)));
  const wanted = new Set(categoryIds ?? []);
  if (wanted.size) {
    for (const c of menu.categories) {
      const whole = wanted.has(c.id);
      if (whole) c.products.forEach(push);
      for (const s of c.subcategories) if (whole || wanted.has(s.id)) s.products.forEach(push);
    }
  }
  return list;
}

/** Variación del plato del día (la indicada o la más barata). */
export function specialVariation(product: PublicProductDto, special: DailySpecial) {
  const exact = special.variationId != null ? product.variations.find((v) => v.id === special.variationId) : undefined;
  return exact ?? product.variations.reduce<PublicProductDto['variations'][number] | null>((min, v) => (!min || v.price < min.price ? v : min), null);
}

/** Producto bloqueado por el plato del día agotado (si es una sola variación de varias, no se bloquea el producto). */
export function soldOutSpecialProduct(menu: PublicLocationMenuDto, byId: ReadonlyMap<number, PublicProductDto>): number | null {
  const special = menu.dynamic?.dailySpecial;
  if (!special?.soldOut) return null;
  const product = byId.get(special.productId);
  if (!product) return null;
  return special.variationId == null || product.variations.length <= 1 ? product.id : null;
}

/** Instantes (ms) en que cambia lo que muestra la carta: fin del momento, de la temporada, del plato del día y próximos momentos. */
export function dynamicBoundaries(dynamic: CartaDynamic | null | undefined, timeZone: string): number[] {
  if (!dynamic) return [];
  const values = [dynamic.moment?.endsAt, dynamic.season?.endsAt, dynamic.dailySpecial?.endsAt, ...(dynamic.upcomingMoments ?? []).map((u) => u.startsAt)];
  return values.map((v) => dynamicTime(v, timeZone)?.at).filter((at): at is number => at != null);
}
