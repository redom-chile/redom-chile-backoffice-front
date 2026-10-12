import { HttpClient, HttpErrorResponse, HttpParams, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';
import { ProductDto, ProductFiltersDto } from './dtos';

@Injectable({ providedIn: 'root' })
export class GetAllProductsService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #params$ = new Subject<ProductFiltersDto>();
  #lastParams: ProductFiltersDto = { page: 1, perPage: 10 };

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));

  readonly $products = toSignal(
    this.#params$.pipe(
      tap(() => this.#isLoading$.next(true)),
      tap(() => this.#error$.next(undefined)),
      switchMap((params) => {
        let httpParams = new HttpParams().set('page', params.page).set('perPage', params.perPage);
        if (params.name?.trim()) httpParams = httpParams.set('name', params.name.trim());
        if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);

        return this.#httpClient
          .get<StandardizedPagination<ProductDto>>(`${ApiPathEnum.RESTAURANT}/products`, { params: httpParams })
          .pipe(
            // Los sets de modificadores también son productos; se administran en Carta → Modificadores.
            map((page) => ({ ...page, data: page.data.filter((product) => product.type !== 'modifier') })),
            tap(() => this.#isLoading$.next(false)),
            catchError((error: HttpErrorResponse) => {
              this.#error$.next(error.status);
              this.#isLoading$.next(false);
              return EMPTY;
            }),
          );
      }),
    ),
  );

  load(params: ProductFiltersDto) {
    this.#lastParams = params;
    this.#params$.next(params);
  }

  retry() {
    this.#params$.next(this.#lastParams);
  }
}
