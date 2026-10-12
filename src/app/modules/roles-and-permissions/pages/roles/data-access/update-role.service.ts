import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { UpdateRoleDto } from './dtos';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiPathEnum } from 'src/environments';
import { ApiError, readApiError } from 'src/app/core/utils';

@Injectable({
  providedIn: 'root',
})
export class UpdateRoleService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<ApiError | undefined>();
  readonly #submit$ = new Subject<UpdateRoleDto>();
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
          this.#httpClient
            .patch(`${ApiPathEnum.AUTH}/roles-and-permissions/roles/${input.id}`, {
              code: input.code,
              name: input.name,
            })
            .pipe(
              tap(() => {
                this.#success$.next(true);
                this.#isLoading$.next(false);
              }),
              catchError((error: unknown) => {
                this.#error$.next(readApiError(error));
                this.#success$.next(false);
                this.#isLoading$.next(false);
                return EMPTY;
              }),
            ),
        ),
      )
      .subscribe();
  }

  update(input: UpdateRoleDto) {
    this.#submit$.next(input);
  }

  reset() {
    this.#error$.next(undefined);
    this.#success$.next(false);
    this.#isLoading$.next(false);
  }
}
