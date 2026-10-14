/** Carta pública, etapa 3: pedidos desde la mesa. Backend: libs/restaurant/public-menu/src/lib/customer-orders-dto.ts. */
import { BankAccountDto, OnlineOrderFieldsDto, OnlinePaymentMethod } from './online-orders.dto';

/** Línea del carrito (sessionStorage redom-cart:{qr}). */
export type CartLineDto = Readonly<{
  productId: number;
  variationId: number;
  /** 1 a 20. */
  quantity: number;
  /** ≤ 200. */
  note?: string;
  /** Cantidad por unidad, 1 a 10; sin repetir opción. */
  modifiers?: ReadonlyArray<{ variationId: number; quantity?: number }>;
  /** Solo packs: lo elegido en los grupos con elección (sin enviar = opciones por defecto). */
  comboChoices?: ReadonlyArray<{ groupId: number; variationId: number }>;
}>;

/** POST /orders: 1 a 30 líneas. */
export type CreatePublicOrderDto = Readonly<{ qrCode: string; items: CartLineDto[]; customerName?: string; note?: string }>;

export type CustomerOrderStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type CustomerOrderProgress = 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'completed' | 'cancelled';

export type PublicOrderItemDto = Readonly<{
  productId: number;
  variationId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  modifiers: ReadonlyArray<{ variationId: number; name: string; quantity: number; unitPrice: number }>;
  packItems: ReadonlyArray<{ variationId: number; name: string; quantity: number; extraPrice: number }>;
  note: string | null;
}>;

/** id: uuid, código de seguimiento público. Etapa 5: suma los campos de retiro y delivery. */
export type PublicOrderDto = OnlineOrderFieldsDto & Readonly<{
  id: string;
  status: CustomerOrderStatus;
  progress: CustomerOrderProgress | null;
  table: Readonly<{ id: number; name: string }> | null;
  items: PublicOrderItemDto[];
  /** Total real (lo calcula el servidor). */
  total: number;
  customerName: string | null;
  note: string | null;
  rejectionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** Etapa 4: encuesta del pedido (null: aún no responde). */
  feedback?: Readonly<{ rating: number; comment: string | null }> | null;
}>;

/** Vista del personal. */
export type CustomerOrderDto = PublicOrderDto &
  Readonly<{
    locationId: number;
    autoAccepted: boolean;
    /** Etapa 5: comprobante de transferencia (URL temporal) y pago registrado. */
    receiptUrl?: string | null;
    paymentId?: number | null;
    decidedBy: string | null;
    transactionId: number | null;
    invoiceNo: string | null;
  }>;

/** menu_settings.ordering (pickup y delivery llegan en la etapa 5). */
export type MenuOrderingSettingsDto = Readonly<{
  tableOrdering: boolean;
  autoAccept: boolean;
  /** null: sin límite. */
  maxOrderTotal: number | null;
  pickup: boolean;
  delivery: boolean;
  /** Etapa 4: llamar al mesero y pedir la cuenta. */
  tableRequests?: boolean;
  /** Etapa 4: reservas desde la carta (requiere la carta publicada). */
  bookings?: boolean;
  /** Etapa 5: 5 a 240 (por defecto 20). */
  prepMinutes?: number;
  paymentMethods?: OnlinePaymentMethod[];
  /** transfer_receipt la exige. */
  bankAccount?: BankAccountDto | null;
}>;
