import { computed, Signal } from '@angular/core';
import { BusinessSettingsService, grossSellPrice } from 'src/app/core/services/business-settings';
import {
  ProductDto,
  ProductModifierSetDto,
  ProductVariationDto,
} from 'src/app/modules/products/pages/product-list/data-access';
import { OrderProductDto } from '../data-access';

export type CartModifier = Readonly<{
  variationId: number;
  name: string;
  // Precio del catálogo por cada vez; solo para estimar, el backend pone el real.
  price: number;
  // Veces por cada unidad del producto (1..10).
  quantity: number;
}>;

/** Opción elegida en un grupo del pack. extraPrice ya viene con IVA (el backend no se lo suma). */
export type CartPackChoice = Readonly<{
  groupId: number;
  variationId: number;
  name: string;
  // Unidades del producto por cada pack.
  quantity: number;
  extraPrice: number;
}>;

/** Variedad que se puede vender ("Frutilla"): activa y con precio. */
export type CartVariety = Readonly<{ variationId: number; name: string; price: number }>;

export type CartLine = Readonly<{
  // Identifica la línea: un mismo producto puede ir en varias líneas con distinta nota u opciones.
  key: string;
  productId: number;
  variationId: number;
  name: string;
  // Variedad elegida (null si el producto tiene precio único).
  variationName: string | null;
  // Variedades ofrecidas al agregarlo, para poder cambiarla al editar.
  varieties: CartVariety[];
  // Precios del catálogo (netos si el negocio vende "más IVA"): usar cartUnitPrice para mostrarlos.
  // basePrice es el producto solo; unitPrice ya suma los modificadores.
  basePrice: number;
  unitPrice: number;
  quantity: number;
  // "sin palta", "término medio"…
  note: string;
  modifiers: CartModifier[];
  // Sets ofrecidos al agregarlo, para volver a editar las opciones.
  modifierSets: ProductModifierSetDto[];
  // Producto tipo pack ('combo'): sus elecciones viajan en comboChoices.
  isPack: boolean;
  packChoices: CartPackChoice[];
}>;

/** Lo que devuelve el modal de opciones. */
export type CartItemConfig = Readonly<{
  // Solo productos con variedades; si no viene se conserva la de la línea.
  variationId?: number;
  quantity: number;
  note: string;
  modifiers: CartModifier[];
  // Solo packs; si no viene se conservan las de la línea.
  packChoices?: CartPackChoice[];
}>;

export const QUICK_NOTES = [
  'sin palta',
  'sin mayo',
  'sin cebolla',
  'sin tomate',
  'sin sal',
  'bien cocido',
  'término medio',
  'para llevar',
];

export const MAX_MODIFIER_TIMES = 10;

export function hasModifierSets(product: ProductDto): boolean {
  return (product.modifierSets ?? []).some((set) => set.options.length > 0);
}

export function isPackProduct(product: Pick<ProductDto, 'type'>): boolean {
  return product.type === 'combo';
}

/** Recargos del pack por unidad (ya con IVA). */
export function packExtras(choices: readonly CartPackChoice[]): number {
  return choices.reduce((sum, choice) => sum + choice.extraPrice, 0);
}

// "Bebida", "2 x Papas"
export function packChoiceLabel(choice: Pick<CartPackChoice, 'name' | 'quantity'>): string {
  return choice.quantity > 1 ? `${choice.quantity} x ${choice.name}` : choice.name;
}

// Activas y con precio, en orden de creación (las variedades quitadas quedan inactivas o sin precio).
function sellableVariations(product: ProductDto): ProductVariationDto[] {
  return product.variations
    .filter((variation) => variation.isActive !== false && variation.sellPriceIncTax !== null)
    .sort((a, b) => a.id - b.id);
}

/** Variedades a elegir al vender; [] si el producto tiene precio único. */
export function productVarieties(product: ProductDto): CartVariety[] {
  const variations = sellableVariations(product);
  if (variations.length < 2) return [];
  return variations.map((variation) => ({
    variationId: variation.id,
    name: variation.name,
    price: variation.sellPriceIncTax ?? 0,
  }));
}

/** Precio único o el menor de las variedades ("Desde"). */
export function productPrice(product: ProductDto): number {
  const prices = sellableVariations(product).map((variation) => variation.sellPriceIncTax ?? 0);
  return prices.length ? Math.min(...prices) : product.variations[0]?.sellPriceIncTax ?? 0;
}

/** Las variedades tienen precios distintos: la tarjeta muestra "Desde". */
export function hasPriceRange(product: ProductDto): boolean {
  const prices = productVarieties(product).map((variety) => variety.price);
  return prices.length > 1 && Math.min(...prices) !== Math.max(...prices);
}

/** Cómo pasar del precio del catálogo al que paga el cliente (Datos fiscales del negocio). */
export type CartPricing = Readonly<{ excludesVat: boolean; vatRate: number; decimals: number }>;

export function cartPricing(settings: BusinessSettingsService): Signal<CartPricing> {
  return computed(() => ({
    excludesVat: settings.$pricesExcludeVat(),
    vatRate: settings.$vatRate(),
    decimals: settings.$currencyPrecision(),
  }));
}

/** Precio con IVA, como lo calcula el backend (cada precio del catálogo por separado). */
export function grossPrice(price: number, pricing: CartPricing): number {
  return grossSellPrice(price, pricing.vatRate, pricing.excludesVat ? 'excludes' : 'includes', pricing.decimals);
}

/**
 * Precio unitario estimado que paga el cliente: producto + opciones (+ recargos del pack), con IVA.
 * Estimación: el backend recalcula y aplica la promoción "en el local" si hay.
 */
export function cartUnitPrice(
  basePrice: number,
  modifiers: readonly CartModifier[],
  pricing: CartPricing,
  extras = 0,
): number {
  return modifiers.reduce(
    (sum, mod) => sum + grossPrice(mod.price, pricing) * mod.quantity,
    grossPrice(basePrice, pricing) + extras,
  );
}

export function cartLineUnitPrice(line: CartLine, pricing: CartPricing): number {
  return cartUnitPrice(line.basePrice, line.modifiers, pricing, packExtras(line.packChoices ?? []));
}

export function cartLineTotal(line: CartLine, pricing: CartPricing): number {
  return cartLineUnitPrice(line, pricing) * line.quantity;
}

export function cartTotal(lines: readonly CartLine[], pricing: CartPricing): number {
  return lines.reduce((sum, line) => sum + cartLineTotal(line, pricing), 0);
}

/** Cómo pasar del precio del catálogo al que paga el cliente (Datos fiscales del negocio). */
export type CartPricing = Readonly<{ excludesVat: boolean; vatRate: number; decimals: number }>;

export function cartPricing(settings: BusinessSettingsService): Signal<CartPricing> {
  return computed(() => ({
    excludesVat: settings.$pricesExcludeVat(),
    vatRate: settings.$vatRate(),
    decimals: settings.$currencyPrecision(),
  }));
}

/** Precio con IVA, como lo calcula el backend (cada precio del catálogo por separado). */
export function grossPrice(price: number, pricing: CartPricing): number {
  return grossSellPrice(price, pricing.vatRate, pricing.excludesVat ? 'excludes' : 'includes', pricing.decimals);
}

/** Precio unitario estimado que paga el cliente: producto + opciones, con IVA. */
export function cartUnitPrice(basePrice: number, modifiers: readonly CartModifier[], pricing: CartPricing): number {
  return modifiers.reduce(
    (sum, mod) => sum + grossPrice(mod.price, pricing) * mod.quantity,
    grossPrice(basePrice, pricing),
  );
}

export function cartLineTotal(line: CartLine, pricing: CartPricing): number {
  return cartUnitPrice(line.basePrice, line.modifiers, pricing) * line.quantity;
}

export function cartTotal(lines: readonly CartLine[], pricing: CartPricing): number {
  return lines.reduce((sum, line) => sum + cartLineTotal(line, pricing), 0);
}

export function unitPriceWithModifiers(basePrice: number, modifiers: readonly CartModifier[]): number {
  return modifiers.reduce((sum, mod) => sum + mod.price * mod.quantity, basePrice);
}

// "+ Extra queso", "+ 2 x Palta"
export function modifierLabel(name: string, times: number): string {
  return times > 1 ? `+ ${times} x ${name}` : `+ ${name}`;
}

// Firma de las opciones (independiente del orden) para saber si dos líneas son el mismo ítem.
function modifiersSignature(modifiers: readonly CartModifier[]): string {
  return modifiers
    .map((mod) => `${mod.variationId}x${mod.quantity}`)
    .sort()
    .join('|');
}

function packSignature(choices: readonly CartPackChoice[]): string {
  return choices
    .map((choice) => `${choice.groupId}:${choice.variationId}`)
    .sort()
    .join('|');
}

function isSameItem(
  line: CartLine,
  other: Pick<CartLine, 'productId' | 'variationId' | 'note' | 'modifiers' | 'packChoices'>,
): boolean {
  return (
    line.productId === other.productId &&
    line.variationId === other.variationId &&
    line.note === other.note &&
    modifiersSignature(line.modifiers) === modifiersSignature(other.modifiers) &&
    packSignature(line.packChoices ?? []) === packSignature(other.packChoices ?? [])
  );
}

function newKey(productId: number): string {
  return `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildLine(product: ProductDto, config: CartItemConfig): CartLine | null {
  const varieties = productVarieties(product);
  const variation =
    product.variations.find((current) => current.id === config.variationId) ??
    sellableVariations(product)[0] ??
    product.variations[0];
  if (!variation) return null;
  const basePrice = variation.sellPriceIncTax ?? 0;
  return {
    key: newKey(product.id),
    productId: product.id,
    variationId: variation.id,
    name: product.name,
    variationName: varieties.length ? variation.name : null,
    varieties,
    basePrice,
    unitPrice: unitPriceWithModifiers(basePrice, config.modifiers),
    quantity: Math.max(1, config.quantity),
    note: config.note.trim(),
    modifiers: config.modifiers,
    modifierSets: product.modifierSets ?? [],
    isPack: isPackProduct(product),
    packChoices: config.packChoices ?? [],
  };
}

// Suma la línea al carrito; si ya hay una idéntica (producto, nota y opciones) solo aumenta su cantidad.
function mergeLine(cart: CartLine[], line: CartLine): CartLine[] {
  const same = cart.find((current) => isSameItem(current, line));
  if (same)
    return cart.map((current) =>
      current === same ? { ...current, quantity: current.quantity + line.quantity } : current,
    );
  return [...cart, line];
}

// Tocar un producto sin opciones suma 1 a su línea sin nota ni opciones; si no hay, abre una línea nueva.
export function addToCart(cart: CartLine[], product: ProductDto): CartLine[] {
  return addConfiguredToCart(cart, product, { quantity: 1, note: '', modifiers: [] });
}

export function addConfiguredToCart(cart: CartLine[], product: ProductDto, config: CartItemConfig): CartLine[] {
  const line = buildLine(product, config);
  return line ? mergeLine(cart, line) : cart;
}

// Reemplaza una línea editada en el modal; si queda igual a otra, se juntan.
export function updateCartLine(
  cart: CartLine[],
  key: string,
  config: CartItemConfig,
  product?: ProductDto,
): CartLine[] {
  const current = cart.find((line) => line.key === key);
  if (!current) return cart;
  // Precio actual de la variedad elegida (o de la que ya tenía la línea).
  const variationId = config.variationId ?? current.variationId;
  const variety = (product ? productVarieties(product) : current.varieties).find(
    (item) => item.variationId === variationId,
  );
  const variation = product?.variations.find((item) => item.id === variationId);
  const basePrice = variety?.price ?? (variation ? variation.sellPriceIncTax ?? current.basePrice : current.basePrice);
  const updated: CartLine = {
    ...current,
    variationId,
    variationName: variety?.name ?? current.variationName,
    varieties: product ? productVarieties(product) : current.varieties,
    basePrice,
    unitPrice: unitPriceWithModifiers(basePrice, config.modifiers),
    quantity: Math.max(1, config.quantity),
    note: config.note.trim(),
    modifiers: config.modifiers,
    modifierSets: product?.modifierSets ?? current.modifierSets,
    packChoices: config.packChoices ?? current.packChoices ?? [],
  };
  const rest = cart.filter((line) => line.key !== key);
  const same = rest.find((line) => isSameItem(line, updated));
  if (!same) return cart.map((line) => (line.key === key ? updated : line));
  return rest.map((line) => (line === same ? { ...line, quantity: line.quantity + updated.quantity } : line));
}

export function changeCartQuantity(cart: CartLine[], key: string, delta: number): CartLine[] {
  return cart.map((line) => (line.key === key ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line));
}

export function removeFromCart(cart: CartLine[], key: string): CartLine[] {
  return cart.filter((line) => line.key !== key);
}

export function setCartNote(cart: CartLine[], key: string, note: string): CartLine[] {
  const current = cart.find((line) => line.key === key);
  if (!current) return cart;
  return updateCartLine(cart, key, { quantity: current.quantity, note, modifiers: current.modifiers });
}

// Cantidad total por producto (para el contador de cada tarjeta del catálogo).
export function quantitiesByProduct(cart: CartLine[]): Record<number, number> {
  return cart.reduce<Record<number, number>>((acc, line) => {
    acc[line.productId] = (acc[line.productId] ?? 0) + line.quantity;
    return acc;
  }, {});
}

// La nota de cada línea viaja en su propio producto (sellLineNote en el backend).
// Los modificadores van sin precio: lo calcula el backend.
// Los packs envían todas sus elecciones (también los grupos fijos) en comboChoices.
export function toOrderProducts(cart: CartLine[]): OrderProductDto[] {
  return cart.map(({ productId, variationId, quantity, note, modifiers, packChoices }) => ({
    productId,
    variationId,
    quantity,
    ...(note ? { note } : {}),
    ...(modifiers.length
      ? {
          modifiers: modifiers.map((mod) =>
            mod.quantity > 1
              ? { variationId: mod.variationId, quantity: mod.quantity }
              : { variationId: mod.variationId },
          ),
        }
      : {}),
    ...(packChoices?.length
      ? { comboChoices: packChoices.map(({ groupId, variationId }) => ({ groupId, variationId })) }
      : {}),
  }));
}
