import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { markStage8Pending } from 'src/app/modules/products/shared';
import { ProductDto } from './dtos';

/**
 * El backend descarta los campos que no conoce sin error: si la respuesta no trae la nota del chef,
 * se relee el producto y, si no quedó guardada, se avisa (sin fingir que se guardó).
 */
export async function checkChefNoteSaved(
  http: HttpClient,
  productId: number | null,
  note: string | null,
  response?: Partial<ProductDto> | null,
): Promise<void> {
  if (!productId) return;
  if (response && 'chefNote' in response && (response.chefNote ?? null) === note) return;
  try {
    const saved = await firstValueFrom(http.get<ProductDto>(`${ApiPathEnum.RESTAURANT}/products/${productId}`));
    if ((saved?.chefNote?.trim() || null) !== note) markStage8Pending();
  } catch {
    // Sin poder releerlo no se sabe: no se avisa nada.
  }
}
