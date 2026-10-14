import { CategoryScheduleRangeDto } from 'src/app/modules/public-menu/data-access';

export type CategoryDto = Readonly<{
  id: number;
  name: string;
  shortCode: string | null;
  parentId: number;
  categoryType: string | null;
  description: string | null;
  slug: string | null;
  imageFileId?: string | null;
  // URL firmada (vence en 1 hora).
  imageUrl?: string | null;
  subcategories?: CategoryDto[];
  // Horario en la carta pública ([] = todo el día). El backend aún no lo devuelve: si no viene, se desconoce.
  schedule?: readonly CategoryScheduleRangeDto[];
}>;

export type CreateCategoryDto = Readonly<{
  name: string;
  shortCode?: string;
  parentId?: number;
  description?: string;
  imageFileId?: string;
}>;

export type UpdateCategoryDto = Readonly<{
  id: number;
  name?: string;
  shortCode?: string;
  description?: string;
  // undefined = no tocar, null = quitar.
  imageFileId?: string | null;
}>;
