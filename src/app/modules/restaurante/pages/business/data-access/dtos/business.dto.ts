export type BusinessDto = Readonly<{
  id: number;
  name: string;
  currencyId: number;
  ownerId: string;
  // #75: el usuario puede ver negocios donde tiene un rol; isOwner indica si es el dueño.
  isOwner?: boolean;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  isActive: boolean;
  // URL firmada (vence en 1 hora).
  logoUrl?: string | null;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}>;
