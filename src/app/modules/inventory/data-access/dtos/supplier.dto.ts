/** Condiciones de pago del proveedor: payTermNumber días o meses (0/null = contado). */
export type SupplierPayTermType = 'days' | 'months';

/** Contacto de tipo proveedor (GET /contacts?type=supplier). Solo los campos que usa inventario. */
export type SupplierDto = Readonly<{
  id: number;
  type: string;
  name: string | null;
  supplierBusinessName: string | null;
  taxNumber: string | null;
  mobile: string;
  email: string | null;
  payTermNumber?: number | null;
  payTermType?: SupplierPayTermType | string | null;
}>;

/** POST /contacts con type "supplier" (mobile es obligatorio en el backend). */
export type CreateSupplierDto = Readonly<{
  type: 'supplier';
  name: string;
  supplierBusinessName?: string;
  taxNumber?: string;
  mobile: string;
  email?: string;
  payTermNumber?: number;
  payTermType?: SupplierPayTermType;
}>;

/** PUT /contacts/:id: todos los campos son opcionales. */
export type UpdateSupplierDto = Partial<Omit<CreateSupplierDto, 'type'>>;
