import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, EMPTY, filter, fromEvent, map, merge, of, Subject, switchMap, timer } from 'rxjs';
import { AccessService, PERMISSIONS } from 'src/app/core/permissions';
import { EntitlementsService } from 'src/app/core/services/entitlements';
import { SupportModeService } from 'src/app/core/services/support-mode';
import { CustomerOrdersService } from 'src/app/modules/public-menu/data-access';

const REFRESH_MS = 30 * 1000;

/**
 * Pedidos de clientes pendientes en todos los locales (badge del menú). Solo consulta con el permiso
 * customer-orders:see-module y el plan con table_ordering; el SUPERADMIN fuera del modo soporte no tiene negocio.
 */
@Injectable({ providedIn: 'root' })
export class CustomerOrderCountService {
  readonly #orders = inject(CustomerOrdersService);
  readonly #document = inject(DOCUMENT);
  readonly #access = inject(AccessService);
  readonly #entitlements = inject(EntitlementsService);
  readonly #support = inject(SupportModeService);
  readonly #refresh$ = new Subject<void>();
  readonly #count = signal(0);

  readonly $count = this.#count.asReadonly();

  readonly #enabled = computed(
    () =>
      !(this.#access.$isSuperAdmin() && !this.#support.$active()) &&
      !!this.#entitlements.$entitlements() &&
      this.#entitlements.hasFeature('table_ordering') &&
      this.#access.can(PERMISSIONS.CUSTOMER_ORDERS.SEE_MODULE),
  );

  constructor() {
    const visible = () => this.#document.visibilityState !== 'hidden';
    toObservable(this.#enabled)
      .pipe(
        distinctUntilChanged(),
        switchMap((enabled) => {
          if (!enabled) {
            this.#count.set(0);
            return EMPTY;
          }
          return merge(
            timer(0, REFRESH_MS).pipe(filter(visible)),
            fromEvent(this.#document, 'visibilitychange').pipe(filter(visible)),
            this.#refresh$,
          ).pipe(
            switchMap(() =>
              this.#orders.list({ status: ['pending'] }).pipe(
                map((orders) => orders.length),
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
