import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { isPlanError } from 'src/app/core/services/entitlements';

@Injectable({ providedIn: 'root' })
export class ActivateDeactivateBusinessLocationService {
  readonly #httpClient = inject(HttpClient);
  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #submit$ = new Subject<number>();
  readonly #success$ = new Subject<boolean>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));
  readonly $success = toSignal(this.#success$);

  constructor() {
    this.#submit$.pipe(
      tap(() => this.#isLoading$.next(true)),
      tap(() => this.#error$.next(undefined)),
      switchMap((id) =>
        this.#httpClient.post(`${ApiPathEnum.RESTAURANT}/business-locations/${id}/activate-deactivate`, { id }).pipe(
          tap(() => { this.#success$.next(true); this.#isLoading$.next(false); }),
          catchError((error: HttpErrorResponse) => { if (!isPlanError(error)) this.#error$.next(error.status); this.#success$.next(false); this.#isLoading$.next(false); return EMPTY; }),
        ),
      ),
    ).subscribe();
  }

  toggle(id: number) { this.#submit$.next(id); }
  reset() { this.#error$.next(undefined); this.#success$.next(false); this.#isLoading$.next(false); }
}
