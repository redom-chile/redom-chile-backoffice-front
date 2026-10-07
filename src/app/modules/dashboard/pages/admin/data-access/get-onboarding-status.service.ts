import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { BusinessSettingsService } from 'src/app/core/services/business-settings';
import { OnboardingStatusDto } from './dtos';

/**
 * Estado de "Primeros pasos" en una sola consulta liviana.
 * Se provee en el componente: vive mientras el checklist está visible.
 */
@Injectable()
export class GetOnboardingStatusService {
  readonly #http = inject(HttpClient);
  readonly #businessId = inject(BusinessSettingsService).$businessId;

  readonly #status = signal<OnboardingStatusDto | null>(null);
  readonly #isLoading = signal(false);
  readonly #hasError = signal(false);
  #request?: Subscription;

  readonly $status = this.#status.asReadonly();
  readonly $isLoading = this.#isLoading.asReadonly();
  readonly $hasError = this.#hasError.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#request?.unsubscribe());
  }

  /** Al recargar se conserva lo anterior en pantalla hasta que llega la respuesta (sin parpadeo). */
  load() {
    const businessId = this.#businessId();
    if (!businessId) return;
    this.#request?.unsubscribe();
    this.#isLoading.set(true);
    this.#request = this.#http
      .get<OnboardingStatusDto>(`${ApiPathEnum.RESTAURANT}/business/${businessId}/onboarding-status`)
      .subscribe({
        next: (status) => {
          this.#status.set(status);
          this.#hasError.set(false);
          this.#isLoading.set(false);
        },
        error: () => {
          this.#status.set(null);
          this.#hasError.set(true);
          this.#isLoading.set(false);
        },
      });
  }
}
