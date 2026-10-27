import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, map, Subject, switchMap, tap } from 'rxjs';
import { BusinessDto } from './dtos';
import { ApiPathEnum } from 'src/environments';
import { WhoamiService } from 'src/app/core/services/whoami/whoami.service';

@Injectable({ providedIn: 'root' })
export class FindMyBusinessesService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #fetch$ = new BehaviorSubject<void>(undefined);

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $hasError = toSignal(this.#error$.pipe(map((code) => code !== undefined)));

  readonly $businesses = toSignal(
    this.#fetch$.pipe(
      tap(() => this.#isLoading$.next(true)),
      tap(() => this.#error$.next(undefined)),
      switchMap(() =>
        this.#httpClient.get<BusinessDto[]>(`${ApiPathEnum.RESTAURANT}/business/my-businesses`).pipe(
          tap(() => this.#isLoading$.next(false)),
          catchError((error: HttpErrorResponse) => {
            this.#error$.next(error.status);
            this.#isLoading$.next(false);
            return EMPTY;
          }),
        ),
      ),
    ),
  );

  readonly #whoami = inject(WhoamiService);
  /** El negocio activo del usuario (puede tener rol en varios); si no se sabe, el primero. */
  readonly $current = computed(() => {
    const businesses = this.$businesses();
    if (!businesses?.length) return undefined;
    const id = this.#whoami.$whoami()?.user.restaurantId;
    return businesses.find((business) => business.id === id) ?? businesses[0];
  });

  retry() {
    this.#fetch$.next(undefined);
  }
}
