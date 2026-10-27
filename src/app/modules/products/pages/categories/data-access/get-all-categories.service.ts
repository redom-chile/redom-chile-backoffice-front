import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { CategoryDto } from './dtos';

@Injectable({ providedIn: 'root' })
export class GetAllCategoriesService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #categories$ = new BehaviorSubject<CategoryDto[]>([]);

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));
  readonly $categories = toSignal(this.#categories$);

  getAll() {
    this.#isLoading$.next(true);
    this.#error$.next(undefined);

    this.#httpClient
      .get<CategoryDto[]>(`${ApiPathEnum.RESTAURANT}/categories`)
      .pipe(
        tap(() => this.#isLoading$.next(false)),
        catchError((error: HttpErrorResponse) => {
          this.#error$.next(error.status);
          this.#isLoading$.next(false);
          return EMPTY;
        })
      )
      .subscribe((categories) => {
        this.#categories$.next(categories);
      });
  }

  /** Reemplaza la lista local (orden optimista y su reversión). */
  setLocal(categories: CategoryDto[]) {
    this.#categories$.next(categories);
  }

  retry() {
    this.getAll();
  }
}
