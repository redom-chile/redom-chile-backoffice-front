import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, filter, fromEvent, map, merge, of, Subject, switchMap, timer } from 'rxjs';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { PlatformService } from '../../data-access';

const REFRESH_MS = 2 * 60 * 1000;

/**
 * Cantidad de cobros con transferencias por revisar (badge del menú). Solo carga para SUPERADMIN:
 * al entrar, cada 2 minutos con la pestaña visible, al volver a la pestaña y tras confirmar o rechazar.
 */
@Injectable({ providedIn: 'root' })
export class PaymentReviewCountService {
  readonly #platform = inject(PlatformService);
  readonly #document = inject(DOCUMENT);
  readonly #refresh$ = new Subject<void>();
  readonly #count = signal(0);

  readonly $count = this.#count.asReadonly();

  constructor() {
    const visible = () => this.#document.visibilityState !== 'hidden';
    toObservable(inject(EntitlementsService).$isSuperAdmin)
      .pipe(
        switchMap((isSuperAdmin) => {
          if (!isSuperAdmin) {
            this.#count.set(0);
            return EMPTY;
          }
          return merge(
            timer(0, REFRESH_MS).pipe(filter(visible)),
            fromEvent(this.#document, 'visibilitychange').pipe(filter(visible)),
            this.#refresh$,
          ).pipe(
            switchMap(() =>
              this.#platform.getInvoices({ pendingReview: true, perPage: 1 }).pipe(
                map((page) => page.pagination?.totalItems ?? 0),
                // Sin conexión o error: se mantiene el último valor.
                catchError(() => of(null)),
              ),
            ),
          );
        }),
      )
      .subscribe((count) => {
        if (count !== null) this.#count.set(count);
      });
  }

  refresh(): void {
    this.#refresh$.next();
  }
}
