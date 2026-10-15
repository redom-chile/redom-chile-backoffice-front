/** Carta pública, etapa 5: retiro y delivery. Backend: customer-orders-dto.ts, delivery-zones*.ts, ordering-settings.ts. */

export type OnlinePaymentMethod = 'transfer_receipt' | 'cash_on_pickup' | 'card_on_pickup' | 'cash_on_delivery' | 'card_on_delivery';
export type OnlineChannel = 'pickup' | 'delivery';
export type CustomerOrderChannel = 'table' | OnlineChannel;
export type OrderPaymentStatus = 'not_required' | 'awaiting_receipt' | 'to_verify' | 'paid' | 'rejected';
export type OrderFulfillment = 'ready' | 'on_the_way' | 'delivered';

export type BankAccountDto = Readonly<{
  bank: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderRut: string;
  email: string | null;
}>;

export type CommuneRefDto = Readonly<{ id: number; name: string }>;

/** Zona de reparto; fee y minOrder con IVA. Comunas o radio (al menos uno). */
export type DeliveryZoneDto = Readonly<{
  id: number;
  locationId: number;
  name: string;
  communes: CommuneRefDto[];
  radiusKm: number | null;
  fee: number;
  minOrder: number;
  /** 5 a 300 (por defecto 45). */
  etaMinutes: number;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type SaveDeliveryZoneDto = Readonly<{
  locationId?: number;
  name?: string;
  communeIds?: number[];
  radiusKm?: number | null;
  fee?: number;
  minOrder?: number;
  etaMinutes?: number | null;
  isActive?: boolean;
  position?: number;
}>;

/** En la carta: null si el plan no tiene online_ordering o el local no activó retiro ni delivery. */
export type PublicOnlineDto = Readonly<{
  pickup: boolean;
  delivery: boolean;
  prepMinutes: number;
  /** Ya filtrado según retiro y delivery. */
  paymentMethods: OnlinePaymentMethod[];
  deliveryZones: ReadonlyArray<Pick<DeliveryZoneDto, 'id' | 'name' | 'communes' | 'radiusKm' | 'fee' | 'minOrder' | 'etaMinutes'>>;
}>;

export type OrderAddressInputDto = Readonly<{
  street: string;
  number?: string;
  details?: string;
  communeId: number;
  latitude?: number;
  longitude?: number;
}>;

/** POST /orders sin qrCode. */
export type CreateOnlineOrderDto = Readonly<{
  businessSlug: string;
  locationSlug: string;
  channel: OnlineChannel;
  items: ReadonlyArray<import('./customer-orders.dto').CartLineDto>;
  customer: Readonly<{ name: string; phone: string; email?: string | null }>;
  /** Obligatorio en delivery. */
  address?: OrderAddressInputDto;
  /** ISO; null = lo antes posible. */
  scheduledFor?: string | null;
  paymentMethod: OnlinePaymentMethod;
  note?: string;
}>;

/** Campos que suma el pedido en la etapa 5 (públicos y del personal). */
export type OnlineOrderFieldsDto = Readonly<{
  channel?: CustomerOrderChannel;
  customerPhone?: string | null;
  customerEmail?: string | null;
  address?: Readonly<{
    street: string;
    number: string | null;
    details: string | null;
    communeId: number;
    communeName: string;
    latitude: number | null;
    longitude: number | null;
  }> | null;
  /** Incluido en total. */
  deliveryFee?: number | null;
  scheduledFor?: string | null;
  paymentMethod?: OnlinePaymentMethod | null;
  paymentStatus?: OrderPaymentStatus;
  /** Mientras la transferencia está pendiente. */
  bankAccount?: BankAccountDto | null;
  fulfillment?: OrderFulfillment | null;
  location?: Readonly<{ name: string; address: string | null; phone: string | null }>;
}>;

export type ReceiptUploadUrlDto = Readonly<{
  fileId: string;
  uploadUrl: string;
  method: 'PUT';
  /** Enviar exactamente estos headers en el PUT. */
  headers: Record<string, string>;
  expiresIn: number;
}>;
