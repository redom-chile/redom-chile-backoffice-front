import { KitchenStatus, OrderStatus, PaymentStatus } from '../../../order-list/data-access';

export type { OrderStatus, PaymentStatus };
export type DiscountType = 'fixed' | 'percentage';

export type OrderLineModifierDto = Readonly<{
  lineId: number;
  modifierSetId: number;
  modifierSetName: string;
  variationId: number;
  name: string;
  // Total: cantidad del producto × veces por unidad.
  quantity: number;
  unitPriceIncTax: number;
  itemTax: number;
}>;

export type OrderLineDto = Readonly<{
  lineId: number;
  productId: number;
  productName: string;
  variationId: number;
  // null cuando el producto no tiene variaciones.
  variationName: string | null;
  quantity: number;
  unitPriceIncTax: number;
  itemTax: number;
  resServiceStaffId: string | null;
  resLineOrderStatus: KitchenStatus | null;
  sellLineNote: string | null;
  // Modificadores elegidos; no aparecen como líneas sueltas.
  modifiers: OrderLineModifierDto[];
  // Producto + sus modificadores.
  lineTotal: number;
  // Pagos por producto (dividir la cuenta). Un pago por monto no los mueve.
  paidQuantity?: number;
  pendingQuantity?: number;
  // Lo que falta pagar de la línea, con modificadores y descuento proporcional.
  pendingAmount?: number;
}>;

export type OrderDetailDto = Readonly<{
  transactionId: number;
  invoiceNo: string;
  businessId: number;
  locationId: number;
  contactId: number | null;
  customerName: string | null;
  resTableId: number | null;
  tableName: string | null;
  resWaiterId: string | null;
  waiterName: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  resOrderStatus: KitchenStatus | null;
  isKitchenOrder: boolean;
  totalBeforeTax: number;
  discountType: DiscountType | null;
  discountAmount: number;
  taxAmount: number;
  finalTotal: number;
  netTotal: number;
  totalPaid: number;
  remaining: number;
  additionalNotes: string | null;
  staffNote: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderLineDto[];
}>;
