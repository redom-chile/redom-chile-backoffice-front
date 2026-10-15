import { DiscountType } from './order-detail.dto';

export type UpdateOrderDto = Readonly<{
  id: number;
  resTableId?: number;
  resWaiterId?: string;
  // Cliente de la venta (acumula fidelización al pagarse); null lo quita.
  contactId?: number | null;
  discountType?: DiscountType;
  discountAmount?: number;
  additionalNotes?: string;
  staffNote?: string;
}>;
