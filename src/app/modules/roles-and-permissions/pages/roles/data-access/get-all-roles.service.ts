import { HttpClient, HttpErrorResponse, HttpStatusCode, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Observable, of, Subject, switchMap, tap } from 'rxjs';
import { GetAllRolesDto } from './dtos';
import { StandardizedPagination } from 'src/app/core/standarized-response';
import { ApiPathEnum } from 'src/environments';

@Injectable({ providedIn: 'root' })
export class GetAllRolesService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));

  readonly #params$ = new BehaviorSubject<{ page: number; perPage: number; searchCode?: string; searchName?: string }>({
    page: 1,
    perPage: 50,
  });

  setParams(params: Partial<{ page: number; perPage: number; searchCode?: string; searchName?: string }>) {
    const current = this.#params$.getValue();
    this.#params$.next({ ...current, ...params });
  }

  readonly $roles = toSignal(
    this.#params$.pipe(
      tap(() => this.#isLoading$.next(true)),
      tap(() => this.#error$.next(undefined)),
      switchMap((params) => {
        let httpParams = new HttpParams().set('page', params.page.toString()).set('perPage', params.perPage.toString());

        if (params.searchCode && params.searchCode.trim() !== '') {
          httpParams = httpParams.set('code', params.searchCode.trim().toUpperCase());
        }
        if (params.searchName && params.searchName.trim() !== '') {
          httpParams = httpParams.set('name', params.searchName.trim());
        }

        return this.#httpClient
          .get<StandardizedPagination<GetAllRolesDto>>(`${ApiPathEnum.AUTH}/roles-and-permissions/roles`, {
            params: httpParams,
          })
          .pipe(
            catchError((error: HttpErrorResponse) => {
              this.#error$.next(error.status);
              this.#isLoading$.next(false);
              return EMPTY;
            }),
            tap(() => this.#isLoading$.next(false)),
          );
      }),
    ),
  );

  retry() {
    this.#params$.next({ ...this.#params$.getValue() });
  }

  /** Todos los roles para un selector, sin tocar la vista paginada de la tabla (que usa el mismo servicio). */
  options(): Observable<GetAllRolesDto[]> {
    return this.#httpClient
      .get<StandardizedPagination<GetAllRolesDto>>(`${ApiPathEnum.AUTH}/roles-and-permissions/roles`, {
        params: new HttpParams().set('page', '1').set('perPage', '100'),
      })
      .pipe(
        map((response) => response.data),
        catchError(() => of([])),
      );
  }
}
