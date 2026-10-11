import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { ApiError, readApiError } from 'src/app/core/utils';

@Injectable({ providedIn: 'root' })
export class AssignRoleToUserService {
  readonly #httpClient = inject(HttpClient);

  readonly #isLoading = signal(false);
  readonly #error = signal<ApiError | undefined>(undefined);
  readonly #success = signal(false);

  readonly $isLoading = this.#isLoading.asReadonly();
  readonly $error = this.#error.asReadonly();
  readonly $hasError = computed(() => this.#error() !== undefined);
  readonly $success = this.#success.asReadonly();

  reset() {
    this.#isLoading.set(false);
    this.#error.set(undefined);
    this.#success.set(false);
  }

  execute(userId: string, roleIds: number[]) {
    this.#isLoading.set(true);
    this.#error.set(undefined);
    this.#success.set(false);

    this.#httpClient
      .post<void>(`${ApiPathEnum.AUTH}/users/${userId}/roles`, { roleIds })
      .pipe(
        catchError((error: unknown) => {
          this.#error.set(readApiError(error));
          this.#isLoading.set(false);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.#success.set(true);
        this.#isLoading.set(false);
      });
  }
}
