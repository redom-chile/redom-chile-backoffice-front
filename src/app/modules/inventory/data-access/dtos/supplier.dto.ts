/** Contacto de tipo proveedor (GET /contacts?type=supplier). Solo los campos que usa inventario. */
export type SupplierDto = Readonly<{
  id: number;
  type: string;
  name: string | null;
  supplierBusinessName: string | null;
  taxNumber: string | null;
  mobile: string;
  email: string | null;
}>;

/** POST /contacts con type "supplier" (mobile es obligatorio en el backend). */
export type CreateSupplierDto = Readonly<{
  type: 'supplier';
  name: string;
  supplierBusinessName?: string;
  taxNumber?: string;
  mobile: string;
  email?: string;
}>;
