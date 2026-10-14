import { PackDto, PackGroupInputDto } from 'src/app/modules/public-menu/data-access';

export const PACK_MAX_GROUPS = 20;
export const PACK_MAX_ITEMS = 50;
export const PACK_GROUP_NAME_MAX = 120;

export type PackEditorItem = Readonly<{
  variationId: number;
  name: string;
  // Precio de referencia (IVA incluido); null si no se conoce (contenido cargado del pack).
  price: number | null;
  quantity: number;
  extraPrice: number;
  isDefault: boolean;
}>;

export type PackEditorGroup = Readonly<{
  // Clave local para el @for y el arrastre (los grupos se reemplazan completos al guardar).
  key: number;
  name: string;
  minChoices: number;
  maxChoices: number;
  items: readonly PackEditorItem[];
}>;

let nextKey = 1;
export function newPackGroupKey(): number {
  return nextKey++;
}

export function emptyPackGroup(): PackEditorGroup {
  return { key: newPackGroupKey(), name: '', minChoices: 1, maxChoices: 1, items: [] };
}

export function fromPackDto(pack: PackDto): PackEditorGroup[] {
  return [...pack.groups]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      key: newPackGroupKey(),
      name: group.name,
      minChoices: group.minChoices,
      maxChoices: group.maxChoices,
      items: [...group.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          variationId: item.variationId,
          name: item.name,
          price: null,
          quantity: Number(item.quantity),
          extraPrice: Number(item.extraPrice),
          isDefault: item.isDefault,
        })),
    }));
}

export function toPackGroupInputs(groups: readonly PackEditorGroup[]): PackGroupInputDto[] {
  return groups.map((group) => ({
    name: group.name.trim(),
    minChoices: group.minChoices,
    maxChoices: group.maxChoices,
    items: group.items.map((item) => ({
      variationId: item.variationId,
      quantity: item.quantity,
      extraPrice: item.extraPrice,
      isDefault: item.isDefault,
    })),
  }));
}

/** Para saber si el contenido cambió (sin la clave local). */
export function packSignature(groups: readonly PackEditorGroup[]): string {
  return JSON.stringify(toPackGroupInputs(groups));
}

/** Un grupo con una sola opción y 1/1 es un componente fijo. */
export function isIncludedGroup(group: PackEditorGroup): boolean {
  return group.items.length === 1 && group.minChoices === 1 && group.maxChoices === 1;
}

const isInt = (value: number) => Number.isInteger(value);

/** Mismas reglas que el backend; devuelve el primer problema en palabras o null. */
export function validatePackGroups(groups: readonly PackEditorGroup[]): string | null {
  if (!groups.length) return 'Agrega al menos un grupo al contenido del pack';
  if (groups.length > PACK_MAX_GROUPS) return `El pack puede tener hasta ${PACK_MAX_GROUPS} grupos`;
  for (const [index, group] of groups.entries()) {
    const label = group.name.trim() ? `"${group.name.trim()}"` : `${index + 1}`;
    if (!group.name.trim()) return `Ponle nombre al grupo ${index + 1} del pack`;
    if (group.name.trim().length > PACK_GROUP_NAME_MAX)
      return `El nombre del grupo ${label} puede tener hasta ${PACK_GROUP_NAME_MAX} caracteres`;
    if (!group.items.length) return `Agrega al menos una opción al grupo ${label}`;
    if (group.items.length > PACK_MAX_ITEMS) return `El grupo ${label} puede tener hasta ${PACK_MAX_ITEMS} opciones`;
    const { minChoices: min, maxChoices: max } = group;
    if (!isInt(min) || !isInt(max) || min < 0 || max < 1 || max < min)
      return `En el grupo ${label}, el cliente elige entre un mínimo (0 o más) y un máximo (1 o más, no menor al mínimo)`;
    if (min > group.items.length) return `En el grupo ${label}, el mínimo no puede superar la cantidad de opciones`;
    const seen = new Set<number>();
    for (const item of group.items) {
      if (seen.has(item.variationId)) return `"${item.name}" está repetido en el grupo ${label}`;
      seen.add(item.variationId);
      if (!(item.quantity > 0)) return `La cantidad de "${item.name}" debe ser mayor a 0`;
      if (!(item.extraPrice >= 0)) return `El recargo de "${item.name}" no puede ser negativo`;
    }
  }
  return null;
}
