import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { CreateCategoryDto } from './dtos';

@Injectable({ providedIn: 'root' })
export class CreateCategoryService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #success$ = new Subject<boolean>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));
  readonly $success = toSignal(this.#success$);
  // Id del creado (para guardar después lo que va por otro endpoint, como etiquetas u horario).
  readonly #createdId = signal<number | null>(null);
  readonly $createdId = this.#createdId.asReadonly();

  create(dto: CreateCategoryDto) {
    this.#isLoading$.next(true);
    this.#error$.next(undefined);

    this.#httpClient
      .post<{ id: number }>(`${ApiPathEnum.RESTAURANT}/categories`, dto)
      .pipe(
        tap(() => this.#isLoading$.next(false)),
        catchError((error: HttpErrorResponse) => {
          this.#error$.next(error.status);
          this.#isLoading$.next(false);
          return EMPTY;
        })
      )
      .subscribe((response) => {
        this.#createdId.set(response?.id ?? null);
        this.#success$.next(true);
      });
  }

  reset() {
    this.#createdId.set(null);
    this.#error$.next(undefined);
    this.#success$.next(false);
    this.#isLoading$.next(false);
  }
}
