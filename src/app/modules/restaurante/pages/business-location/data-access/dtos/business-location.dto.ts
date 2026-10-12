export type BusinessLocationDto = Readonly<{
  id: number;
  businessId: number;
  locationId: string;
  name: string;
  landmark: string;
  country: string;
  state: string;
  city: string;
  zipCode: string;
  createdAt: Date;
  /** Inactivo: no cuenta para el límite de locales del plan. */
  isActive?: boolean;
}>;
