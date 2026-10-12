import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, Observable, of, shareReplay } from 'rxjs';
import { ApiPathEnum } from 'src/environments';
import { PublicPlanDto } from './dtos';

/** Planes públicos (GET /plans/public, sin sesión). Se piden una vez y se comparten. */
@Injectable({ providedIn: 'root' })
export class PublicPlansService {
  readonly #http = inject(HttpClient);
  readonly plans$: Observable<PublicPlanDto[]> = this.#http
    .get<PublicPlanDto[]>(`${ApiPathEnum.BILLING}/plans/public`)
    .pipe(
      catchError(() => of([] as PublicPlanDto[])),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  readonly $plans = toSignal(this.plans$, { initialValue: [] as PublicPlanDto[] });

  /** Nombre del plan por código (para "Disponible desde el plan Emprende"). */
  planName(code: string | null | undefined): string | null {
    if (!code) return null;
    return this.$plans().find((plan) => plan.code === code)?.name ?? code.charAt(0).toUpperCase() + code.slice(1);
  }

  /** El primer plan público (de menor a mayor) que incluye todas las funciones. */
  firstPlanWith(features: readonly string[]): PublicPlanDto | null {
    return this.$plans().find((plan) => features.every((code) => plan.features.some((f) => f.code === code))) ?? null;
  }
}
