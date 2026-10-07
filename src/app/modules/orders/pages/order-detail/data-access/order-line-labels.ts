import { OrderLineDto, OrderLineModifierDto } from './dtos';

// Los productos sin variaciones reales traen null o la variación "DUMMY", que no se muestra.
export function orderVariationLabel(name: string | null | undefined): string | null {
  return name && name !== 'DUMMY' ? name : null;
}

// Veces que se aplica el modificador a cada unidad (la cantidad del modificador es el total de la línea).
export function modifierTimesPerUnit(line: OrderLineDto, modifier: OrderLineModifierDto): number {
  return line.quantity > 0 ? Math.round(modifier.quantity / line.quantity) : modifier.quantity;
}

// "Extra queso" o "2 x Sin hielo" cuando va más de una vez por unidad.
export function modifierLabel(line: OrderLineDto, modifier: OrderLineModifierDto): string {
  const times = modifierTimesPerUnit(line, modifier);
  return times > 1 ? `${times} x ${modifier.name}` : modifier.name;
}
