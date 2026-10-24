import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ReorderCategoriesDto } from './dtos';

/** Orden manual de categorías (etapa 8, #68). Se envía el grupo completo después de cada movimiento. */
@Injectable({ providedIn: 'root' })
export class ReorderCategoriesService {
  readonly #http = inject(HttpClient);

  reorder(dto: ReorderCategoriesDto): Observable<unknown> {
    return this.#http.patch(`${ApiPathEnum.RESTAURANT}/categories/reorder`, dto);
  }
}
