import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, EMPTY, Subject, switchMap, tap } from 'rxjs';
import { ApiError, readApiError } from 'src/app/core/utils';
import { CreateTablesBulkDto, CreateTablesBulkResultDto } from './dtos';
import { ApiPathEnum } from 'src/environments';

@Injectable({ providedIn: 'root' })
export class CreateTablesBulkService {
  readonly #httpClient = inject(HttpClient);
  readonly #isLoading$ = new BehaviorSubject(false);
  readonly #error$ = new BehaviorSubject<ApiError | undefined>(undefined);
  readonly #result$ = new BehaviorSubject<CreateTablesBulkResultDto | undefined>(undefined);
  readonly #submit$ = new Subject<CreateTablesBulkDto>();

  readonly $isLoading = toSignal(this.#isLoading$, { initialValue: false });
  readonly $error = toSignal(this.#error$, { initialValue: undefined });
  readonly $result = toSignal(this.#result$, { initialValue: undefined });

  constructor() {
    this.#submit$.pipe(
      tap(() => { this.#isLoading$.next(true); this.#error$.next(undefined); this.#result$.next(undefined); }),
      switchMap((input) => this.#httpClient.post<CreateTablesBulkResultDto>(`${ApiPathEnum.RESTAURANT}/tables/bulk`, input).pipe(
        tap((result) => { this.#result$.next(result); this.#isLoading$.next(false); }),
        catchError((e: unknown) => { this.#error$.next(readApiError(e)); this.#isLoading$.next(false); return EMPTY; }),
      )),
    ).subscribe();
  }

  create(input: CreateTablesBulkDto) { this.#submit$.next(input); }
  reset() { this.#error$.next(undefined); this.#result$.next(undefined); this.#isLoading$.next(false); }
}
