import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, Subject, tap } from 'rxjs';
import { ApiError, readApiError } from 'src/app/core/utils';
import { ApiPathEnum } from 'src/environments';
import { CreatePaymentDto, CreatePaymentResponseDto } from './dtos';

@Injectable({ providedIn: 'root' })
export class CreatePaymentService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new Subject<ApiError | undefined>();
  readonly #result$ = new Subject<(CreatePaymentResponseDto & { request: CreatePaymentDto }) | null>();

  readonly $isLoading = toSignal(this.#isLoading$);
  readonly $error = toSignal(this.#error$);
  // Resultado del último pago junto con lo enviado (para mostrar el vuelto y el resumen).
  readonly $result = toSignal(this.#result$);

  create(dto: CreatePaymentDto) {
    this.#isLoading$.next(true);
    this.#error$.next(undefined);

    this.#httpClient
      .post<CreatePaymentResponseDto>(`${ApiPathEnum.RESTAURANT}/payments`, dto)
      .pipe(
        tap(() => this.#isLoading$.next(false)),
        catchError((error: unknown) => {
          // Se conserva el mensaje: el 409 por falta de stock se distingue por el texto.
          this.#error$.next(readApiError(error));
          this.#isLoading$.next(false);
          return EMPTY;
        }),
      )
      .subscribe((response) => this.#result$.next({ ...response, request: dto }));
  }

  reset() {
    this.#error$.next(undefined);
    this.#result$.next(null);
    this.#isLoading$.next(false);
  }
}
