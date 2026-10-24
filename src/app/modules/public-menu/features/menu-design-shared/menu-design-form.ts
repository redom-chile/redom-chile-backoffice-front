import { readApiError } from 'src/app/core/utils/api-error';
import {
  CHEF_PICKS_MAX,
  ChefPicksDto,
  DEFAULT_MENU_DESIGN,
  MenuAccessibilityDto,
  MenuAnnouncementInputDto,
  MenuCardStyle,
  MenuChefScheduleDto,
  MenuDesignDto,
  MenuFont,
  MenuTemplate,
  PublicMenuDesignDto,
  SaveChefPicksDto,
  UpdateMenuDesignDto,
} from 'src/app/modules/public-menu/data-access';
import { safeZone } from 'src/app/modules/public-menu/features/marketing-schedule-field';
import { ANNOUNCEMENT_MAX, CHEF_TITLE_MAX, DEFAULT_CHEF_TITLE } from './menu-design-options';

/** Fechas como 'YYYY-MM-DDTHH:MM' (input datetime-local) en la zona del negocio; '' = sin fecha. */
export type AnnouncementForm = Readonly<{ isActive: boolean; text: string; startsAt: string; endsAt: string }>;

export type DesignDraft = Readonly<{
  template: MenuTemplate;
  font: MenuFont;
  cardStyle: MenuCardStyle;
  categoryStyles: Readonly<Record<string, MenuCardStyle>>;
  accessibility: MenuAccessibilityDto;
  announcement: AnnouncementForm;
}>;

/** Un tramo del horario: varios días con la misma hora (sin días = todos). */
export type ChefRange = Readonly<{ days: readonly number[]; startTime: string; endTime: string }>;

export type ChefDraft = Readonly<{ isActive: boolean; title: string; productIds: readonly number[]; ranges: readonly ChefRange[] }>;

export const EMPTY_CHEF_PICKS: ChefPicksDto = {
  locationId: 0,
  isActive: false,
  title: DEFAULT_CHEF_TITLE,
  photoFileId: null,
  photoUrl: null,
  productIds: [],
  products: [],
  schedule: [],
  updatedAt: null,
};

/** El servidor no tiene la ruta (backend sin la etapa 8): 405 o 404 de Nest "Cannot GET …", no un local inexistente. */
export function isStageMissing(error: unknown): boolean {
  const { status, message } = readApiError(error);
  return status === 405 || (status === 404 && /^Cannot (GET|POST|PUT|PATCH)\b/i.test(message));
}

// --- Fechas en la zona del negocio ---

type Parts = Readonly<{ year: number; month: number; day: number; hour: number; minute: number }>;

function partsIn(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute') };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - (date.getTime() - (date.getTime() % 60_000));
}

const pad = (value: number) => String(value).padStart(2, '0');

export function isoToLocalInput(iso: string | null | undefined, timeZone?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsIn(date, safeZone(timeZone));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** ISO con el offset de la zona del negocio, p. ej. 2026-10-30T20:00:00-03:00. */
export function localInputToIso(value: string, timeZone?: string | null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const zone = safeZone(timeZone);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = offsetMs(new Date(guess), zone);
  let offset = first;
  const second = offsetMs(new Date(guess - first), zone);
  if (second !== first) offset = second;
  const p = partsIn(new Date(guess - offset), zone);
  const minutes = Math.round(offset / 60_000);
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// --- Diseño ---

export function designFromDto(dto: MenuDesignDto | null | undefined, timeZone?: string | null): DesignDraft {
  const announcement = dto?.announcement ?? null;
  return {
    template: dto?.template ?? DEFAULT_MENU_DESIGN.template,
    font: dto?.font ?? DEFAULT_MENU_DESIGN.font,
    cardStyle: dto?.cardStyle ?? DEFAULT_MENU_DESIGN.cardStyle,
    categoryStyles: { ...(dto?.categoryStyles ?? {}) },
    accessibility: { ...DEFAULT_MENU_DESIGN.accessibility, ...(dto?.accessibility ?? {}) },
    announcement: {
      isActive: !!announcement?.isActive,
      text: announcement?.text ?? '',
      startsAt: isoToLocalInput(announcement?.startsAt, timeZone),
      endsAt: isoToLocalInput(announcement?.endsAt, timeZone),
    },
  };
}

/** Sin texto se quita (null); si no, va completo. */
export function announcementToDto(form: AnnouncementForm, timeZone?: string | null): MenuAnnouncementInputDto | null {
  const text = form.text.trim();
  if (!text) return null;
  return { text, startsAt: localInputToIso(form.startsAt, timeZone), endsAt: localInputToIso(form.endsAt, timeZone), isActive: form.isActive };
}

export const publicDesign = (draft: DesignDraft): PublicMenuDesignDto => ({
  template: draft.template,
  font: draft.font,
  cardStyle: draft.cardStyle,
  categoryStyles: draft.categoryStyles,
  accessibility: draft.accessibility,
});

const sortedRecord = (record: Readonly<Record<string, unknown>>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Solo las claves que cambiaron; categoryStyles va con el mapa completo (el backend lo reemplaza). */
export function designChanges(saved: DesignDraft, draft: DesignDraft, timeZone?: string | null): UpdateMenuDesignDto {
  const changes: { -readonly [K in keyof UpdateMenuDesignDto]: UpdateMenuDesignDto[K] } = {};
  if (saved.template !== draft.template) changes.template = draft.template;
  if (saved.font !== draft.font) changes.font = draft.font;
  if (saved.cardStyle !== draft.cardStyle) changes.cardStyle = draft.cardStyle;
  if (!same(sortedRecord(saved.categoryStyles), sortedRecord(draft.categoryStyles))) changes.categoryStyles = draft.categoryStyles;
  if (!same(saved.accessibility, draft.accessibility)) changes.accessibility = draft.accessibility;
  const announcement = announcementToDto(draft.announcement, timeZone);
  if (!same(announcementToDto(saved.announcement, timeZone), announcement)) changes.announcement = announcement;
  return changes;
}

/** Mensaje si el diseño no se puede guardar; null si está bien. */
export function designProblem(draft: DesignDraft): string | null {
  const { isActive, text, startsAt, endsAt } = draft.announcement;
  if (text.trim().length > ANNOUNCEMENT_MAX) return `El anuncio puede tener hasta ${ANNOUNCEMENT_MAX} caracteres.`;
  if (isActive && !text.trim()) return 'Escribe el texto del anuncio o desactívalo.';
  if (startsAt && endsAt && endsAt <= startsAt) return 'El término del anuncio debe ser posterior al inicio.';
  return null;
}

// --- Recomendaciones del chef ---

export function chefFromDto(dto: ChefPicksDto | null | undefined): ChefDraft {
  const groups = new Map<string, number[]>();
  for (const item of dto?.schedule ?? []) {
    const key = `${item.startTime.slice(0, 5)}-${item.endTime.slice(0, 5)}`;
    groups.set(key, [...(groups.get(key) ?? []), item.dayOfWeek]);
  }
  const ranges = [...groups.entries()].map(([key, days]) => {
    const [startTime, endTime] = key.split('-');
    return { days: days.length >= 7 ? [] : [...new Set(days)].sort((a, b) => a - b), startTime, endTime };
  });
  return { isActive: !!dto?.isActive, title: dto?.title ?? DEFAULT_CHEF_TITLE, productIds: [...(dto?.productIds ?? [])], ranges };
}

/** Cada tramo se expande a un rango por día. */
export function chefSchedule(ranges: readonly ChefRange[]): MenuChefScheduleDto[] {
  const all = [0, 1, 2, 3, 4, 5, 6];
  const list = ranges.flatMap((range) => (range.days.length ? range.days : all).map((dayOfWeek) => ({ dayOfWeek, startTime: range.startTime, endTime: range.endTime })));
  const unique = new Map(list.map((item) => [`${item.dayOfWeek}|${item.startTime}|${item.endTime}`, item]));
  return [...unique.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

/** PUT parcial: photoFileId solo si se eligió o quitó la foto (undefined = se mantiene). */
export function chefToDto(draft: ChefDraft, photoFileId: string | null | undefined): SaveChefPicksDto {
  return {
    isActive: draft.isActive,
    title: draft.title.trim() || DEFAULT_CHEF_TITLE,
    ...(photoFileId !== undefined ? { photoFileId } : {}),
    productIds: [...draft.productIds],
    schedule: chefSchedule(draft.ranges),
  };
}

export const sameChef = (a: ChefDraft, b: ChefDraft) =>
  a.isActive === b.isActive && a.title.trim() === b.title.trim() && same(a.productIds, b.productIds) && same(chefSchedule(a.ranges), chefSchedule(b.ranges));

export function chefProblem(draft: ChefDraft): string | null {
  if (draft.title.trim().length > CHEF_TITLE_MAX) return `El título puede tener hasta ${CHEF_TITLE_MAX} caracteres.`;
  if (draft.productIds.length > CHEF_PICKS_MAX) return `Puedes elegir hasta ${CHEF_PICKS_MAX} productos.`;
  if (new Set(draft.productIds).size !== draft.productIds.length) return 'Hay un producto repetido en las recomendaciones.';
  if (draft.isActive && !draft.productIds.length) return 'Elige al menos un producto o desactiva las recomendaciones.';
  for (const range of draft.ranges) {
    if (!range.startTime || !range.endTime) return 'Indica la hora de inicio y de término de cada horario.';
    if (range.startTime === range.endTime) return 'La hora de término debe ser distinta a la de inicio.';
  }
  return null;
}
