import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { UpdateProductDto } from './dtos';

@Injectable({ providedIn: 'root' })
export class UpdateProductService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #success$ = new Subject<boolean>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));
  readonly $success = toSignal(this.#success$);
  // Error completo (el mensaje del backend sirve para las reglas de inventario).
  readonly #lastError = signal<HttpErrorResponse | null>(null);
  readonly $lastError = this.#lastError.asReadonly();

  update(id: number, dto: UpdateProductDto) {
    this.#isLoading$.next(true);
    this.#lastError.set(null);
    this.#error$.next(undefined);

    this.#httpClient
      .put<{ id: number }>(`${ApiPathEnum.RESTAURANT}/products/${id}`, dto)
      .pipe(
        tap(() => this.#isLoading$.next(false)),
        catchError((error: HttpErrorResponse) => {
          this.#lastError.set(error);
          this.#error$.next(error.status);
          this.#isLoading$.next(false);
          return EMPTY;
        }),
      )
      .subscribe(() => this.#success$.next(true));
  }

  reset() {
    this.#lastError.set(null);
    this.#error$.next(undefined);
    this.#success$.next(false);
    this.#isLoading$.next(false);
  }
}
