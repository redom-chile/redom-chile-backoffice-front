import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { markStage8Pending } from 'src/app/modules/products/shared';
import { CategoryDto } from './dtos';

/**
 * El PUT de la categoría no devuelve nada y el backend descarta los campos que no conoce:
 * se relee la categoría y, si el ícono no quedó, se avisa (sin fingir que se guardó).
 */
export async function checkCategoryIconSaved(http: HttpClient, categoryId: number | null, icon: string | null): Promise<void> {
  if (!categoryId) return;
  try {
    const saved = await firstValueFrom(http.get<CategoryDto>(`${ApiPathEnum.RESTAURANT}/categories/${categoryId}`));
    if ((saved?.icon ?? null) !== icon) markStage8Pending();
  } catch {
    // Sin poder releerla no se sabe: no se avisa nada.
  }
}
