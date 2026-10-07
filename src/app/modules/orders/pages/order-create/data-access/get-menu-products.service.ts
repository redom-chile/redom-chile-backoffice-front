import { HttpClient, HttpErrorResponse, HttpParams, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { ProductDto } from 'src/app/modules/products/pages/product-list/data-access';

// Máximo que permite el backend por página; alcanza para la carta de un local.
const MENU_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class GetMenuProductsService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #filters$ = new Subject<{ categoryId: number | null; name: string }>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);

  // Solo lo vendible: el backend filtra activos, no marcados "no a la venta" y con precio.
  readonly $products = toSignal(
    this.#filters$.pipe(
      tap(() => this.#isLoading$.next(true)),
      tap(() => this.#error$.next(undefined)),
      switchMap(({ categoryId, name }) => {
        let params = new HttpParams()
          .set('page', 1)
          .set('perPage', MENU_PAGE_SIZE)
          .set('isActive', true)
          .set('sellable', true);
        if (categoryId) params = params.set('categoryId', categoryId);
        if (name.trim()) params = params.set('name', name.trim());

        return this.#httpClient
          .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params })
          .pipe(
            // Las opciones de modificadores llegan igual con sellable=true: no se venden solas.
            map(({ data }) => data.filter((product) => product.type !== 'modifier')),
            tap(() => this.#isLoading$.next(false)),
            catchError((error: HttpErrorResponse) => {
              this.#error$.next(error.status);
              this.#isLoading$.next(false);
              return EMPTY;
            }),
          );
      }),
    ),
    { initialValue: [] as ProductDto[] },
  );

  #lastFilters = { categoryId: null as number | null, name: '' };

  load(filters: { categoryId: number | null; name: string }) {
    this.#lastFilters = filters;
    this.#filters$.next(filters);
  }

  // Vuelve a pedir la carta con los mismos filtros (p. ej. si cambiaron las opciones de un producto).
  reload() {
    this.#filters$.next(this.#lastFilters);
  }
}
