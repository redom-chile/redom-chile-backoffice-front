import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { DeleteUserDto } from './dtos';
import { ApiPathEnum } from 'src/environments';
import { EntitlementsService } from 'src/app/core/services/entitlements';

@Injectable({ providedIn: 'root' })
export class DeleteUserService {
  readonly #httpClient = inject(HttpClient);
  readonly #entitlements = inject(EntitlementsService);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #submit$ = new Subject<DeleteUserDto>();
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
          this.#httpClient.delete<{ message: string }>(`${ApiPathEnum.AUTH}/users/${input.userId}`).pipe(
            tap(() => {
              this.#entitlements.refresh();
              this.#success$.next(true);
              this.#isLoading$.next(false);
            }),
            catchError((error: HttpErrorResponse) => {
              this.#error$.next(error.status);
              this.#success$.next(false);
              this.#isLoading$.next(false);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  delete(input: DeleteUserDto) {
    this.#submit$.next(input);
  }

  reset() {
    this.#error$.next(undefined);
    this.#success$.next(false);
    this.#isLoading$.next(false);
  }
}
