import { CreateBusinessLocationDto } from 'src/app/modules/restaurante/pages/business-location/data-access/dtos';

export type CreateBusinessDto = Readonly<{
  name: string;
  currencyId: number;
  // IANA (America/Santiago); el backend responde 400 si no es válida.
  timeZone?: string;
  dateFormat?: string;
  timeFormat?: string;
  // Primer local, creado en la misma transacción.
  location?: CreateBusinessLocationDto;
}>;

// locationId solo viene cuando se envió `location`.
export type CreateBusinessResponseDto = Readonly<{ id: number; locationId?: number }>;
