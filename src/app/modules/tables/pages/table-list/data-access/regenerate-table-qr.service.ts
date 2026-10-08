import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, Subject, tap } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { isPlanError } from 'src/app/core/services/entitlements';

export type TableQrDto = Readonly<{ qrCode: string; qrUrl: string | null }>;

@Injectable({ providedIn: 'root' })
export class RegenerateTableQrService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<HttpStatusCode | undefined>();
  readonly #result$ = new Subject<TableQrDto | null>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  readonly $result = toSignal(this.#result$);

  regenerate(tableId: number) {
    this.#isLoading$.next(true);
    this.#error$.next(undefined);

    this.#httpClient
      .post<TableQrDto>(`${ApiPathEnum.RESTAURANT}/tables/${tableId}/qr`, {})
      .pipe(
        tap(() => this.#isLoading$.next(false)),
        catchError((error: HttpErrorResponse) => {
          // El error de plan ya muestra su modal.
          if (!isPlanError(error)) this.#error$.next(error.status);
          this.#isLoading$.next(false);
          return EMPTY;
        }),
      )
      .subscribe((result) => this.#result$.next(result));
  }

  reset() {
    this.#error$.next(undefined);
    this.#result$.next(null);
    this.#isLoading$.next(false);
  }
}
