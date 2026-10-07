import { DiscountType } from '../../../order-detail/data-access';

export type OrderModifierDto = Readonly<{
  // Opción elegida (variación del set). El precio lo pone el backend.
  variationId: number;
  // Veces que se aplica por cada unidad del producto (1..10, por defecto 1).
  quantity?: number;
}>;

export type OrderProductDto = Readonly<{
  productId: number;
  variationId: number;
  quantity: number;
  // Nota de este producto ("sin palta"): se imprime en la comanda de su estación y se ve en el KDS.
  note?: string;
  modifiers?: OrderModifierDto[];
}>;

export type CreateOrderDto = Readonly<{
  locationId: number;
  contactId?: number;
  products: OrderProductDto[];
  resTableId?: number;
  resWaiterId?: string;
  isKitchenOrder?: boolean;
  discountType?: DiscountType;
  discountAmount?: number;
  additionalNotes?: string;
  // Nota general del pedido; las de cada producto van en products[].note.
  staffNote?: string;
}>;

export type CreateOrderResponseDto = Readonly<{
  transactionId: number;
  invoiceNo: string;
  printJobIds: number[];
}>;

export type AddOrderLinesDto = Readonly<{
  orderId: number;
  // Cada producto lleva su propia nota; el endpoint no recibe nota general.
  products: OrderProductDto[];
}>;
