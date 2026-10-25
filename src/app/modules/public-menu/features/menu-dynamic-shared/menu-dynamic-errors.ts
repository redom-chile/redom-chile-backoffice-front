import { isPlanError } from 'src/app/core/services/entitlements';
import { ApiError, readApiError } from 'src/app/core/utils/api-error';
import { marketingSaveError } from 'src/app/modules/public-menu/features/marketing-shared';
import { categoryName, MenuDynamicCatalog, namesSummary, productName } from './menu-dynamic-catalog';

export const STAGE_MISSING_MESSAGE = 'La carta dinámica no está disponible en este servidor.';

/** El servidor no tiene la ruta: 405, o 404 de Nest "Cannot GET …" (no un registro inexistente). */
export function isDynamicStageMissing(error: unknown): boolean {
  const { status, message } = readApiError(error);
  return status === 405 || (status === 404 && /^Cannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(message));
}

/** Campo rechazado por el backend (MENU_DYNAMIC_INVALID con details.field, la ruta completa: "weather.hot.minTempC"). */
export function dynamicInvalidField(error: unknown): string | null {
  const api = readApiError(error);
  if (api.code !== 'MENU_DYNAMIC_INVALID') return null;
  const field = api.details['field'];
  return typeof field === 'string' && field ? field : null;
}

/** Momento con el que se cruza (MENU_MOMENT_OVERLAP con details.momentId). */
export function overlapMomentId(error: unknown): number | null {
  return detailId(error, 'MENU_MOMENT_OVERLAP', 'momentId');
}

/** Plato del día con el que se cruza (MENU_DAILY_SPECIAL_OVERLAP con details.dailySpecialId). */
export function overlapDailySpecialId(error: unknown): number | null {
  return detailId(error, 'MENU_DAILY_SPECIAL_OVERLAP', 'dailySpecialId');
}

/** Porciones ya vendidas cuando se intenta bajar portions por debajo (details.portionsSold). */
export function portionsSoldOf(error: unknown): number | null {
  const api = readApiError(error);
  if (api.code !== 'MENU_DYNAMIC_INVALID' || api.details['field'] !== 'portions') return null;
  const sold = Number(api.details['portionsSold']);
  return Number.isInteger(sold) && sold >= 0 ? sold : null;
}

export const portionsSoldMessage = (sold: number) => (sold === 1 ? 'Ya se vendió 1 porción: no puedes dejar menos.' : `Ya se vendieron ${sold} porciones: no puedes dejar menos.`);

/** Mensaje para un error al guardar; null si es de plan (ya lo muestra el modal global). */
export function dynamicSaveError(error: unknown, fallback: string, catalog: MenuDynamicCatalog | null = null): string | null {
  if (isPlanError(error)) return null;
  if (isDynamicStageMissing(error)) return STAGE_MISSING_MESSAGE;
  const api = readApiError(error);
  if (api.code === 'MENU_DYNAMIC_INVALID') return invalidMessage(api, catalog);
  return marketingSaveError(error, fallback);
}

function detailId(error: unknown, code: string, key: string): number | null {
  const api = readApiError(error);
  if (api.code !== code) return null;
  const id = Number(api.details[key]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const idsOf = (value: unknown): number[] => (Array.isArray(value) ? value.map(Number).filter((id) => Number.isInteger(id) && id > 0) : []);

/** 400 MENU_DYNAMIC_INVALID en palabras, según details.field y los ids rechazados. */
function invalidMessage(api: ApiError, catalog: MenuDynamicCatalog | null): string {
  const field = typeof api.details['field'] === 'string' ? api.details['field'] : '';
  const productIds = idsOf(api.details['productIds']);
  if (productIds.length) {
    const names = namesSummary(
      productIds.map((id) => productName(catalog, id)),
      4,
    );
    return /not for sale/i.test(api.message) ? `Estos productos no están a la venta: ${names}. Quítalos de la lista.` : `Estos productos ya no existen: ${names}. Quítalos de la lista.`;
  }
  const categoryIds = idsOf(api.details['categoryIds']);
  if (categoryIds.length)
    return `Estas categorías ya no existen: ${namesSummary(
      categoryIds.map((id) => categoryName(catalog, id)),
      4,
    )}. Quítalas de la lista.`;

  const sold = Number(api.details['portionsSold']);
  if (field === 'portions' && Number.isInteger(sold)) return portionsSoldMessage(sold);
  if (field === 'productId' && /sold portions/i.test(api.message)) return 'Este plato del día ya vendió porciones: no puedes cambiar el producto. Crea otro plato del día.';
  if (field === 'portions') return 'Las porciones deben ser 1 o más, o sin límite.';
  if (field === 'price') return 'El precio debe ser 0 o más, o el de la carta.';
  if (field === 'variationId') return 'La variedad elegida no es de este producto.';
  if (field === 'bannerId') return 'El banner elegido ya no existe.';
  if (field === 'locationId') return /change location/i.test(api.message) ? 'Un momento no puede cambiar de local.' : 'Elige un local válido.';
  if (field === 'endsAt' || field === 'startsAt') return /after/i.test(api.message) ? 'El término debe ser posterior al inicio.' : 'Revisa la fecha y hora.';
  if (field === 'startTime' || field === 'endTime') return 'Usa horas en formato HH:MM.';
  if (field === 'days') return 'Elige al menos un día de la semana.';
  if (field === 'icon') return 'Elige uno de los íconos disponibles.';
  if (field === 'mode') return 'Elige si el momento destaca o muestra solo lo suyo.';
  if (field === 'name') return /required/i.test(api.message) ? 'Escribe un nombre.' : 'El nombre es demasiado largo.';
  if (field === 'title') return 'El título puede tener hasta 60 caracteres.';
  if (field === 'note') return 'La nota puede tener hasta 160 caracteres.';
  if (field === 'message') return 'El mensaje puede tener hasta 80 caracteres.';
  if (field === 'categoryIds') return 'Elige al menos una categoría o un producto.';
  if (field === 'productIds') return /banner/i.test(api.message) ? 'Elige al menos un producto o un banner.' : 'Elige al menos un producto.';
  if (field === 'triggerProductIds' || field === 'triggerCategoryIds') return 'Elige al menos un producto o una categoría que active la regla.';
  if (field === 'suggestProductIds') return 'Elige de 1 a 6 productos para sugerir.';
  if (field === 'ids') return 'La lista cambió mientras ordenabas. Recarga e inténtalo de nuevo.';
  if (field === 'suggestions.maxItems') return 'Puedes mostrar de 1 a 6 sugerencias.';
  if (field === 'suggestions.mode') return 'Elige de dónde salen las sugerencias.';
  if (field === 'suggestions.excludeProductIds') return 'Revisa los productos excluidos.';
  if (field === 'weather.enabled') return 'Revisa si el clima está encendido.';
  if (/^weather\.(hot|cold)\.(minTempC|maxTempC)$/.test(field)) return 'La temperatura debe estar entre −30 y 50 °C.';
  if (/^weather\.\w+\.(productIds|categoryIds)$/.test(field))
    return /at least/i.test(api.message) ? 'Cada regla de clima necesita al menos un producto o una categoría.' : 'Revisa los productos y categorías de la regla de clima.';
  if (/^weather\.\w+\.title$/.test(field)) return 'El título de la regla puede tener hasta 60 caracteres.';
  return 'Revisa los datos ingresados.';
}
