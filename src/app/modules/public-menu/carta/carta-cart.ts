import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { readApiError } from 'src/app/core/utils/api-error';
import { CartLineDto, PublicOrderDto } from '../data-access/dtos/customer-orders.dto';
import { PublicLocationMenuDto, PublicProductDto } from '../data-access/dtos/public-menu.dto';
import { getPublicMenuErrorMessage } from '../data-access/public-menu-error-message';
import { formatMenuPrice } from '../data-access/public-menu-format';
import { isPackUnavailable, productsById } from './carta-marketing';

// --- Límites del backend (customer-orders-dto.ts) ---

export const MAX_CART_LINES = 30;
export const MAX_LINE_QUANTITY = 20;
export const MAX_MODIFIER_QUANTITY = 10;
export const MAX_LINE_NOTE = 200;
export const MAX_ORDER_NOTE = 300;
export const MAX_CUSTOMER_NAME = 80;
/** Pedidos que se recuerdan por mesa. */
const MAX_TRACKED_ORDERS = 20;
/** Seguimiento del pedido. */
export const ORDER_POLL_DELAY = 5000;

/** Línea del carrito: lo que se envía (line) y lo que se muestra (precio estimado por unidad). */
export type CartItem = Readonly<{
  /** Id local de la línea. */
  key: string;
  line: CartLineDto;
  name: string;
  /** Variación, modificadores y opciones del pack, ya en palabras. */
  details: readonly string[];
  /** Estimado: variación + recargos del pack + modificadores (por unidad). El real lo calcula el servidor. */
  unitPrice: number;
  /** Por qué no se puede pedir (se agotó, fuera de horario...). */
  issue: string | null;
}>;

export type CartAddition = Omit<CartItem, 'key' | 'issue'>;

export type CartaSheet =
  | Readonly<{ kind: 'cart' }>
  | Readonly<{ kind: 'orders' }>
  | Readonly<{ kind: 'order'; id: string; order: PublicOrderDto | null }>;

export const cartStorageKey = (qr: string) => `redom-cart:${qr}`;
export const ordersStorageKey = (qr: string) => `redom-orders:${qr}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- Disponibilidad en la carta ---

export type ProductBlock = 'sold_out' | 'out_of_schedule' | 'pack_unavailable';

/** Productos que no se pueden agregar: agotados, packs sin opciones o de categorías fuera de horario. */
export function blockedProducts(menu: PublicLocationMenuDto): Map<number, ProductBlock> {
  const map = new Map<number, ProductBlock>();
  const check = (products: readonly PublicProductDto[], available: boolean) => {
    for (const p of products) {
      if (p.soldOut) map.set(p.id, 'sold_out');
      else if (p.pack && isPackUnavailable(p.pack.groups)) map.set(p.id, 'pack_unavailable');
      else if (!available) map.set(p.id, 'out_of_schedule');
    }
  };
  for (const c of menu.categories) {
    check(c.products, c.availableNow);
    c.subcategories.forEach((s) => check(s.products, c.availableNow && s.availableNow));
  }
  check(menu.uncategorized, true);
  return map;
}

export const BLOCK_LABELS: Record<ProductBlock, string> = {
  sold_out: 'Agotado',
  out_of_schedule: 'Fuera de horario',
  pack_unavailable: 'No disponible',
};

/** Textos de PRODUCT_UNAVAILABLE (details.reason). */
export const UNAVAILABLE_REASONS: Record<string, string> = {
  sold_out: 'Se agotó',
  out_of_schedule: 'Fuera de horario',
  not_in_menu: 'Ya no está en la carta',
};

// --- Errores al enviar ---

export type OrderSendError = Readonly<{
  message: string;
  /** PRODUCT_UNAVAILABLE: producto y motivo para marcar la línea. */
  productId?: number;
  reason?: string;
  /** PACK_CHOICES_INVALID o una opción del pack inactiva: marcar las líneas del pack (details.groupId). */
  pack?: boolean;
  groupId?: number;
  /** Recargar la carta. */
  reload?: boolean;
}>;

export function readOrderError(error: unknown): OrderSendError {
  const api = readApiError(error);
  const d = api.details;
  if (api.status === 0) return { message: 'No hay conexión. Revisa tu internet' };
  switch (api.code) {
    case 'ORDERING_DISABLED':
      return { message: 'Este local no está recibiendo pedidos desde la mesa' };
    case 'LOCATION_CLOSED':
      return { message: 'El local está cerrado' };
    case 'TABLE_BLOCKED':
      return { message: 'Esta mesa no está disponible. Llama al mesero' };
    case 'PRODUCT_UNAVAILABLE': {
      const productId = typeof d['productId'] === 'number' ? d['productId'] : undefined;
      const reason = typeof d['reason'] === 'string' ? d['reason'] : undefined;
      if (productId != null) {
        const text = (reason && UNAVAILABLE_REASONS[reason]) || 'No disponible';
        return { message: 'Hay productos que ya no se pueden pedir. Revisa tu carrito', productId, reason: text, reload: true };
      }
      // 400: una opción de un pack quedó inactiva
      return { message: 'Revisa las opciones del pack', pack: true, groupId: typeof d['groupId'] === 'number' ? d['groupId'] : undefined, reload: true };
    }
    case 'PACK_CHOICES_INVALID':
      return { message: 'Revisa las opciones del pack', pack: true, groupId: typeof d['groupId'] === 'number' ? d['groupId'] : undefined };
    case 'ORDER_TOO_LARGE': {
      const max = Number(d['maxOrderTotal']);
      return { message: Number.isFinite(max) ? `El pedido supera el máximo de ${formatMenuPrice(max)}` : 'El pedido supera el máximo permitido' };
    }
    case 'TOO_MANY_PENDING_ORDERS':
      return { message: 'Tu mesa tiene pedidos esperando confirmación. Espera un momento' };
    case 'RATE_LIMITED':
      return { message: 'Demasiados intentos, espera un minuto' };
    case 'MENU_NOT_FOUND':
      return { message: 'El código QR de esta mesa ya no es válido. Pide al mesero el nuevo' };
    case 'MODIFIER_NOT_AVAILABLE':
    case 'MODIFIER_REPEATED':
      return { message: getPublicMenuErrorMessage(error), reload: api.code === 'MODIFIER_NOT_AVAILABLE' };
  }
  if (api.status === 429) return { message: 'Demasiados intentos, espera un minuto' };
  return { message: api.message || 'No pudimos enviar tu pedido. Intenta de nuevo' };
}

// --- Estado del pedido ---

export type OrderStatusView = Readonly<{ text: string; tone: 'waiting' | 'progress' | 'done' | 'bad'; final: boolean }>;

export function orderStatus(order: Pick<PublicOrderDto, 'status' | 'progress' | 'rejectionReason'>): OrderStatusView {
  switch (order.status) {
    case 'pending':
      return { text: 'Esperando confirmación del local', tone: 'waiting', final: false };
    case 'rejected': {
      const reason = order.rejectionReason?.trim();
      return { text: reason ? `El local no pudo tomar tu pedido: ${reason}` : 'El local no pudo tomar tu pedido', tone: 'bad', final: true };
    }
    case 'cancelled':
      return { text: 'Cancelaste el pedido', tone: 'bad', final: true };
  }
  switch (order.progress) {
    case 'ready':
      return { text: '¡Listo! Ya va a tu mesa', tone: 'done', final: false };
    case 'delivered':
      return { text: 'Entregado', tone: 'done', final: false };
    case 'completed':
      return { text: 'Cuenta cerrada. ¡Gracias!', tone: 'done', final: true };
    case 'cancelled':
      return { text: 'El local anuló la venta', tone: 'bad', final: true };
    default:
      return { text: 'En preparación', tone: 'progress', final: false };
  }
}

// --- Almacenamiento ---

function readJson(storage: () => Storage, key: string): unknown {
  try {
    const raw = storage().getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: () => Storage, key: string, value: unknown): void {
  try {
    if (value == null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    // Modo privado o almacenamiento lleno: el carrito sigue en memoria
  }
}

const session = () => sessionStorage;
const local = () => localStorage;

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Solo líneas con la forma esperada (el almacenamiento puede venir alterado). */
function sanitizeItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const line = item['line'] as Record<string, unknown> | undefined;
  if (!line || typeof item['key'] !== 'string' || typeof item['name'] !== 'string' || typeof item['unitPrice'] !== 'number') return null;
  if (!Number.isInteger(line['productId']) || !Number.isInteger(line['variationId']) || !isInt(line['quantity'], 1, MAX_LINE_QUANTITY)) return null;
  const modifiers = Array.isArray(line['modifiers'])
    ? (line['modifiers'] as Record<string, unknown>[]).filter((m) => m && Number.isInteger(m['variationId']) && isInt(m['quantity'] ?? 1, 1, MAX_MODIFIER_QUANTITY))
    : undefined;
  const choices = Array.isArray(line['comboChoices'])
    ? (line['comboChoices'] as Record<string, unknown>[]).filter((c) => c && Number.isInteger(c['groupId']) && Number.isInteger(c['variationId']))
    : undefined;
  const note = typeof line['note'] === 'string' ? line['note'].slice(0, MAX_LINE_NOTE) : undefined;
  return {
    key: item['key'],
    name: item['name'],
    unitPrice: item['unitPrice'],
    details: Array.isArray(item['details']) ? item['details'].filter((d): d is string => typeof d === 'string') : [],
    issue: typeof item['issue'] === 'string' ? item['issue'] : null,
    line: {
      productId: line['productId'] as number,
      variationId: line['variationId'] as number,
      quantity: line['quantity'] as number,
      ...(note ? { note } : {}),
      ...(modifiers?.length ? { modifiers: modifiers as unknown as CartLineDto['modifiers'] } : {}),
      ...(choices?.length ? { comboChoices: choices as unknown as CartLineDto['comboChoices'] } : {}),
    },
  };
}

/** Dos líneas iguales (mismo producto, opciones y nota) se juntan. */
function signature(line: CartLineDto): string {
  const mods = [...(line.modifiers ?? [])].map((m) => `${m.variationId}x${m.quantity ?? 1}`).sort();
  const choices = [...(line.comboChoices ?? [])].map((c) => `${c.groupId}:${c.variationId}`).sort();
  return JSON.stringify([line.productId, line.variationId, mods, choices, line.note?.trim() ?? '']);
}

function newKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Línea a enviar: sin campos vacíos. */
export function toOrderLine(item: CartItem): CartLineDto {
  const { productId, variationId, quantity, note, modifiers, comboChoices } = item.line;
  return {
    productId,
    variationId,
    quantity,
    ...(note?.trim() ? { note: note.trim().slice(0, MAX_LINE_NOTE) } : {}),
    ...(modifiers?.length ? { modifiers } : {}),
    ...(comboChoices?.length ? { comboChoices } : {}),
  };
}

/**
 * Carrito de una mesa (sessionStorage redom-cart:{qr}) y los pedidos que se siguen (localStorage redom-orders:{qr}).
 * También guarda qué hoja está abierta (carrito, mis pedidos o un pedido). Se provee en la vista de la carta.
 */
@Injectable()
export class CartaCart {
  #qr: string | null = null;

  readonly items = signal<readonly CartItem[]>([]);
  readonly customerName = signal('');
  readonly note = signal('');
  /** Pedidos de esta mesa, el más nuevo primero. */
  readonly orderIds = signal<readonly string[]>([]);
  readonly sheet = signal<CartaSheet | null>(null);
  /** Aviso breve ("Agregado al carrito"). */
  readonly notice = signal<string | null>(null);

  readonly count = computed(() => this.items().reduce((sum, i) => sum + i.line.quantity, 0));
  readonly total = computed(() => this.items().reduce((sum, i) => sum + i.unitPrice * i.line.quantity, 0));
  readonly full = computed(() => this.items().length >= MAX_CART_LINES);
  readonly hasIssues = computed(() => this.items().some((i) => i.issue));

  #noticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.#noticeTimer) clearTimeout(this.#noticeTimer);
    });
  }

  /** Carga el carrito de la mesa (o lo vacía si no hay mesa). */
  init(qr: string | null): void {
    if (qr === this.#qr) return;
    this.#qr = qr;
    this.sheet.set(null);
    if (!qr) {
      this.items.set([]);
      this.orderIds.set([]);
      return;
    }
    const stored = readJson(session, cartStorageKey(qr)) as Record<string, unknown> | null;
    const items = Array.isArray(stored?.['items']) ? (stored['items'] as unknown[]).map(sanitizeItem).filter((i): i is CartItem => !!i) : [];
    this.items.set(items.slice(0, MAX_CART_LINES));
    this.customerName.set(typeof stored?.['customerName'] === 'string' ? stored['customerName'].slice(0, MAX_CUSTOMER_NAME) : '');
    this.note.set(typeof stored?.['note'] === 'string' ? stored['note'].slice(0, MAX_ORDER_NOTE) : '');
    const ids = readJson(local, ordersStorageKey(qr));
    this.orderIds.set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && UUID.test(id)).slice(0, MAX_TRACKED_ORDERS) : []);
  }

  /** false si el carrito ya tiene el máximo de líneas distintas. */
  add(addition: CartAddition): boolean {
    const sig = signature(addition.line);
    const items = this.items();
    const same = items.find((i) => !i.issue && signature(i.line) === sig);
    if (same) {
      const quantity = Math.min(MAX_LINE_QUANTITY, same.line.quantity + addition.line.quantity);
      this.#set(items.map((i) => (i === same ? { ...i, line: { ...i.line, quantity } } : i)));
    } else {
      if (items.length >= MAX_CART_LINES) return false;
      this.#set([...items, { ...addition, key: newKey(), issue: null }]);
    }
    this.flash('Agregado al carrito');
    return true;
  }

  setQuantity(key: string, quantity: number): void {
    const q = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.round(quantity)));
    this.#set(this.items().map((i) => (i.key === key ? { ...i, line: { ...i.line, quantity: q } } : i)));
  }

  setLineNote(key: string, note: string): void {
    const value = note.slice(0, MAX_LINE_NOTE);
    this.#set(
      this.items().map((i) => {
        if (i.key !== key) return i;
        const { note: _old, ...line } = i.line;
        return { ...i, line: value.trim() ? { ...line, note: value } : line };
      }),
    );
  }

  remove(key: string): void {
    this.#set(this.items().filter((i) => i.key !== key));
  }

  setCustomerName(value: string): void {
    this.customerName.set(value.slice(0, MAX_CUSTOMER_NAME));
    this.#persist();
  }

  setNote(value: string): void {
    this.note.set(value.slice(0, MAX_ORDER_NOTE));
    this.#persist();
  }

  /** PRODUCT_UNAVAILABLE: marca las líneas de ese producto. */
  markProduct(productId: number, issue: string): void {
    this.#set(this.items().map((i) => (i.line.productId === productId ? { ...i, issue } : i)));
  }

  /** PACK_CHOICES_INVALID: marca las líneas del pack que tiene ese grupo. */
  markPackGroup(menu: PublicLocationMenuDto, groupId: number | undefined, issue: string): void {
    const products = [...productsById(menu).values()].filter((p) => p.pack?.groups.some((g) => groupId == null || g.id === groupId)).map((p) => p.id);
    this.#set(this.items().map((i) => (products.includes(i.line.productId) ? { ...i, issue } : i)));
  }

  /** Con la carta (re)cargada: marca lo que ya no se puede pedir. Las marcas del servidor se mantienen. */
  revalidate(menu: PublicLocationMenuDto): void {
    const products = productsById(menu);
    const blocked = blockedProducts(menu);
    const items = this.items().map((i) => {
      const product = products.get(i.line.productId);
      let issue: string | null = null;
      if (!product || !product.variations.some((v) => v.id === i.line.variationId)) issue = UNAVAILABLE_REASONS['not_in_menu'];
      else {
        const block = blocked.get(product.id);
        if (block === 'sold_out') issue = UNAVAILABLE_REASONS['sold_out'];
        else if (block === 'out_of_schedule') issue = UNAVAILABLE_REASONS['out_of_schedule'];
        else if (block === 'pack_unavailable') issue = BLOCK_LABELS.pack_unavailable;
      }
      return issue && issue !== i.issue ? { ...i, issue } : i;
    });
    if (items.some((item, idx) => item !== this.items()[idx])) this.#set(items);
  }

  /** Tras un 200: vacía el carrito (y la nota) y guarda el pedido para seguirlo. */
  ordered(order: PublicOrderDto): void {
    this.items.set([]);
    this.note.set('');
    this.#persist();
    this.orderIds.update((ids) => [order.id, ...ids.filter((id) => id !== order.id)].slice(0, MAX_TRACKED_ORDERS));
    if (this.#qr) writeJson(local, ordersStorageKey(this.#qr), this.orderIds());
  }

  /** Pedido que ya no existe (404). */
  forgetOrder(id: string): void {
    this.orderIds.update((ids) => ids.filter((i) => i !== id));
    if (this.#qr) writeJson(local, ordersStorageKey(this.#qr), this.orderIds().length ? this.orderIds() : null);
  }

  flash(text: string): void {
    if (this.#noticeTimer) clearTimeout(this.#noticeTimer);
    this.notice.set(text);
    this.#noticeTimer = setTimeout(() => this.notice.set(null), 2500);
  }

  #set(items: readonly CartItem[]): void {
    this.items.set(items);
    this.#persist();
  }

  #persist(): void {
    if (!this.#qr) return;
    const empty = !this.items().length && !this.customerName() && !this.note();
    writeJson(session, cartStorageKey(this.#qr), empty ? null : { v: 1, items: this.items(), customerName: this.customerName(), note: this.note() });
  }
}
