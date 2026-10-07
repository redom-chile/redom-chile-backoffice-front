export type KitchenLineDto = Readonly<{
  lineId: number;
  productName: string;
  variationName: string | null;
  quantity: number;
  resLineOrderStatus: string | null;
  // Indicación del producto para cocina ("sin palta").
  sellLineNote: string | null;
  // Modificadores ya formateados ("Extra queso", "2 x Sin hielo").
  modifiers: string[];
}>;

// Comanda pendiente: solo trae las líneas aún por preparar (received).
export type KitchenOrderDto = Readonly<{
  transactionId: number;
  invoiceNo: string;
  tableName: string | null;
  waiterName: string | null;
  orderDate: string;
  // Nota del pedido que también sale en las comandas impresas.
  staffNote: string | null;
  additionalNotes: string | null;
  lineOrders: KitchenLineDto[];
}>;
