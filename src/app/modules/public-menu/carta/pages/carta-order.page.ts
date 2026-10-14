import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PublicOrderDto } from '../../data-access/dtos/customer-orders.dto';
import { ORDER_ID_PATTERN } from '../carta-cart';
import { CARTA_BASE_PATH } from '../carta-utils';
import { CartaIcon } from '../ui/carta-icon';
import { CartaOrderTracking } from '../ui/carta-order-tracking';
import { CartaUnavailable } from '../ui/carta-states';

type NavState = Readonly<{ back: string | null; timeZone: string; order: PublicOrderDto | null }>;

/** Lo que deja la carta al navegar (history.state): a dónde volver, la zona horaria y la respuesta del POST. */
function readState(router: Router, basePath: string): NavState {
  const navigation = router.currentNavigation()?.extras.state as Record<string, unknown> | undefined;
  const raw = (navigation ?? (typeof history === 'undefined' ? null : history.state)) as Record<string, unknown> | null;
  const back = typeof raw?.['back'] === 'string' && raw['back'].startsWith(`${basePath}/`) ? raw['back'] : null;
  const timeZone = typeof raw?.['timeZone'] === 'string' && raw['timeZone'] ? raw['timeZone'] : 'America/Santiago';
  // La respuesta del POST solo al llegar desde la carta (al recargar, history.state la tendría vieja)
  const order = navigation?.['order'] && typeof navigation['order'] === 'object' ? (navigation['order'] as PublicOrderDto) : null;
  return { back, timeZone, order };
}

/**
 * /carta/pedido/{id}: seguimiento de un pedido de retiro o delivery (etapa 5). Es la página que enlazan los correos
 * al cliente ({QR_BASE_URL}/pedido/{id}); sin la carta, la zona horaria por defecto es la de Chile.
 */
@Component({
  selector: 'app-carta-order-page',
  imports: [RouterLink, CartaIcon, CartaOrderTracking, CartaUnavailable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (orderId of ids(); track orderId) {
      <div class="min-h-dvh bg-background text-foreground antialiased">
        <main class="mx-auto max-w-2xl pb-[env(safe-area-inset-bottom)] sm:px-4 sm:pt-6">
          @if (state.back) {
            <a
              [routerLink]="state.back"
              class="ml-3 mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary sm:ml-0"
            >
              <app-carta-icon name="chevron-left" [size]="16" />
              Volver a la carta
            </a>
          }
          <app-carta-order-tracking
            class="sm:rounded-3xl sm:border sm:border-border sm:bg-card"
            [orderId]="orderId"
            [initial]="state.order"
            [timeZone]="state.timeZone"
            [standalone]="true"
            [backLabel]="null"
          />
        </main>
      </div>
    } @empty {
      <app-carta-unavailable />
    }
  `,
})
export class CartaOrderPage {
  readonly #route = inject(ActivatedRoute);
  protected readonly state = readState(inject(Router), inject(CARTA_BASE_PATH));

  /** null: el id no es un uuid. */
  protected readonly id = toSignal(
    this.#route.paramMap.pipe(
      map((p) => {
        const id = p.get('id')?.toLowerCase() ?? '';
        return ORDER_ID_PATTERN.test(id) ? id : null;
      }),
    ),
    { initialValue: null },
  );
  /** Al cambiar de pedido se crea un seguimiento nuevo. */
  protected readonly ids = computed(() => {
    const id = this.id();
    return id ? [id] : [];
  });

  constructor() {
    const meta = inject(Meta);
    inject(Title).setTitle('Tu pedido | Carta');
    meta.updateTag({ name: 'robots', content: 'noindex' });
    inject(DestroyRef).onDestroy(() => meta.removeTag("name='robots'"));
  }
}
