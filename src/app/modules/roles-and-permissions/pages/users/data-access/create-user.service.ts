import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { CreateUserDto } from './dtos';
import { ApiPathEnum } from 'src/environments';
import { ApiError, readApiError } from 'src/app/core/utils';
import { EntitlementsService, isPlanError } from 'src/app/core/services/entitlements';

@Injectable({ providedIn: 'root' })
export class CreateUserService {
  readonly #httpClient = inject(HttpClient);
  readonly #entitlements = inject(EntitlementsService);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<ApiError | undefined>();
  readonly #submit$ = new Subject<CreateUserDto>();
  readonly #success$ = new Subject<boolean>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));
  readonly $success = toSignal(this.#success$);

  constructor() {
    this.#submit$
      .pipe(
        tap(() => this.#isLoading$.next(true)),
        tap(() => this.#error$.next(undefined)),
        switchMap((input) =>
          this.#httpClient.post<{ code: string }>(`${ApiPathEnum.AUTH}/internal-user`, input).pipe(
            tap(() => {
              this.#entitlements.refresh();
              this.#success$.next(true);
              this.#isLoading$.next(false);
            }),
            catchError((error: unknown) => {
              // El error de plan ya muestra su modal: sin toast genérico.
              if (!isPlanError(error)) this.#error$.next(readApiError(error));
              this.#success$.next(false);
              this.#isLoading$.next(false);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  create(input: CreateUserDto) {
    this.#submit$.next(input);
  }

  reset() {
    this.#error$.next(undefined);
    this.#success$.next(false);
    this.#isLoading$.next(false);
  }
}
