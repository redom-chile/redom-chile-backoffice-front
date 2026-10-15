import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { readApiError } from 'src/app/core/utils/api-error';
import { CartaLang } from './i18n/carta-dict';
import { COMMON_DICT } from './i18n/common';
import { ORDER_DICT } from './i18n/order';
import { SERVICE_DICT } from './i18n/service';
import { TRACKING_DICT } from './i18n/tracking';

export type { CartaLang } from './i18n/carta-dict';

/**
 * Textos fijos de la carta pública en el idioma de la carta (menu.language). Los textos del local (productos,
 * categorías, banners…) ya vienen traducidos por el backend.
 */

export const CARTA_LANGS: readonly CartaLang[] = ['es', 'en', 'pt', 'de'];

export const CARTA_LANG_META: Readonly<Record<CartaLang, Readonly<{ flag: string; code: string; name: string; locale: string }>>> = {
  es: { flag: '🇪🇸', code: 'ES', name: 'Español', locale: 'es-CL' },
  en: { flag: '🇬🇧', code: 'EN', name: 'English', locale: 'en-US' },
  pt: { flag: '🇧🇷', code: 'PT', name: 'Português', locale: 'pt-BR' },
  de: { flag: '🇩🇪', code: 'DE', name: 'Deutsch', locale: 'de-DE' },
};

/** Elección del cliente (selector de idioma). */
const STORAGE_KEY = 'redom-menu-lang';

const DICTS = [COMMON_DICT, ORDER_DICT, TRACKING_DICT, SERVICE_DICT] as const;

type EsKeys<D> = D extends { es: infer E } ? keyof E : never;
export type CartaKey = EsKeys<(typeof DICTS)[number]> & string;
/** Claves con `.one` / `.other`. */
export type CartaPluralKey = CartaKey extends infer K ? (K extends `${infer B}.one` ? B : never) : never;
export type CartaParams = Readonly<Record<string, string | number>>;

const TABLES = Object.fromEntries(
  CARTA_LANGS.map((lang) => [lang, Object.assign({}, ...DICTS.map((d) => d[lang])) as Record<string, string>]),
) as Record<CartaLang, Record<string, string>>;

/** Días (0 domingo), nombre completo y corto. */
const DAYS: Readonly<Record<CartaLang, Readonly<{ long: readonly string[]; short: readonly string[] }>>> = {
  es: {
    long: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    short: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  },
  en: {
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  pt: {
    long: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    short: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  },
  de: {
    long: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    short: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  },
};

export const isCartaLang = (value: unknown): value is CartaLang => typeof value === 'string' && (CARTA_LANGS as readonly string[]).includes(value);

/** Idioma activo. Global para que también lo usen las funciones sin inyección (dentro de computed es reactivo). */
const current = signal<CartaLang>('es');

export const cartaLanguage = current.asReadonly();

/** Locale de Intl para fechas y horas ('es-CL', 'en-US', 'pt-BR', 'de-DE'). Los precios siempre en CLP (formatMenuPrice). */
export const cartaLocale = (): string => CARTA_LANG_META[current()].locale;

/** Texto en el idioma activo; sin traducción, el español. */
export function ct(key: CartaKey, params?: CartaParams): string {
  const text = TABLES[current()][key] ?? TABLES.es[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;
}

/** Plural: `key.one` con n === 1, si no `key.other`. {n} queda disponible en el texto. */
export function ctn(key: CartaPluralKey, n: number, params?: CartaParams): string {
  return ct(`${key}.${n === 1 ? 'one' : 'other'}` as CartaKey, { n, ...params });
}

export const cartaDayName = (day: number): string => DAYS[current()].long[day] ?? '';
export const cartaDayShort = (day: number): string => DAYS[current()].short[day] ?? '';

/**
 * Error de la API en el idioma activo (equivale a getPublicMenuErrorMessage). `fallback`: texto ya traducido para los
 * códigos desconocidos.
 */
export function cartaErrorMessage(error: unknown, fallback?: string): string {
  const api = readApiError(error);
  if (api.status === 0) return ct('error.offline');
  const key = `error.${api.code}`;
  if (api.code && key in TABLES.es) return ct(key as CartaKey);
  return fallback ?? ct('error.generic');
}

function readStored(): CartaLang | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isCartaLang(value) ? value : null;
  } catch {
    return null;
  }
}

/** ?lang= de la URL de entrada. */
function readUrlLang(): CartaLang | null {
  if (typeof location === 'undefined') return null;
  try {
    const value = new URLSearchParams(location.search).get('lang');
    return isCartaLang(value) ? value : null;
  } catch {
    return null;
  }
}

function browserLang(): CartaLang | null {
  if (typeof navigator === 'undefined') return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lang = tag?.slice(0, 2).toLowerCase();
    if (isCartaLang(lang)) return lang;
  }
  return null;
}

/**
 * Idioma de la carta pública. Con carta: el de la respuesta (menu.language). Sin carta (seguimiento desde el correo,
 * selector de locales): ?lang=, la elección guardada o el idioma del navegador.
 */
@Injectable({ providedIn: 'root' })
export class CartaI18n {
  readonly #document = inject(DOCUMENT);

  readonly language = cartaLanguage;
  readonly locale = computed(() => CARTA_LANG_META[current()].locale);
  readonly t = ct;
  readonly tn = ctn;

  /** Idioma pedido (?lang= o el elegido); se mantiene en la URL al navegar dentro de la carta. */
  readonly requested = signal<CartaLang | null>(readUrlLang());
  readonly queryParams = computed((): Readonly<Record<string, string>> => {
    const lang = this.requested();
    return lang ? { lang } : {};
  });

  /** Ya lo fijó una carta: no se cambia por la heurística de las páginas sin carta. */
  #fromMenu = false;
  readonly #active = signal(false);

  constructor() {
    effect(() => {
      if (this.#active()) this.#document.documentElement.setAttribute('lang', current());
    });
  }

  /** Lo llaman las páginas públicas (nunca la vista previa): mantiene <html lang>. */
  activate(): void {
    this.#active.set(true);
  }

  /** Páginas sin carta: URL > guardado > navegador > español (si ninguna carta lo fijó antes). */
  useFallback(): void {
    if (this.#fromMenu) return;
    current.set(this.requested() ?? readStored() ?? browserLang() ?? 'es');
  }

  /** Idioma con el que pedir la carta: URL > guardado > ninguno (el backend usa Accept-Language). */
  menuRequest(urlLang: string | null): CartaLang | null {
    const lang = isCartaLang(urlLang) ? urlLang : null;
    if (lang) this.requested.set(lang);
    return lang ?? readStored();
  }

  /** El de la respuesta de la carta. */
  useMenuLanguage(lang: CartaLang | null | undefined): void {
    this.#fromMenu = true;
    current.set(isCartaLang(lang) ? lang : 'es');
  }

  /** Elección del cliente en el selector. */
  choose(lang: CartaLang): void {
    this.requested.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* sin almacenamiento: vale por la URL */
    }
  }
}
